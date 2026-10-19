import type { A2Program } from './a2sysex'
import type { LoadedCard } from './cards'

/**
 * Audio previews: assets/previews/<CARD FILE>/<slot>.m4a, e.g. assets/previews/GUIT1/00.m4a.
 * Only the patches that have a file get a play button.
 */
const urls = import.meta.glob('/assets/previews/*/*.m4a', { query: '?url', import: 'default', eager: true }) as Record<string, string>

/** "GUIT1/00" → file URL. */
export const previewFiles: Record<string, string> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => {
    const [card, file] = path.split('/').slice(-2)
    return [`${card.toUpperCase()}/${file.replace(/\.m4a$/i, '')}`, url]
  }),
)

const NAME_BYTES = [9, 16]

/** Identifies how a patch sounds: every byte except its name, so a renamed copy keeps its preview. */
export const soundKey = (raw: Uint8Array) =>
  Array.from(raw, (b, i) => (i >= NAME_BYTES[0] && i < NAME_BYTES[1] ? '' : b.toString(16).padStart(2, '0'))).join('')

/**
 * Maps each library patch that has a preview to its URL, keyed by sound. A patch copied to the
 * destination keeps its preview; once its parameters are edited it no longer matches.
 */
export function buildPreviewIndex(cards: LoadedCard[], files: Record<string, string> = previewFiles) {
  const index = new Map<string, string>()
  for (const card of cards) {
    const folder = card.file.replace(/\.syx$/i, '').toUpperCase()
    for (const program of card.bank.programs) {
      const url = files[`${folder}/${String(program.slot).padStart(2, '0')}`]
      if (url) index.set(soundKey(program.raw), url)
    }
  }
  return index
}

/**
 * Audio preview lookup and the single player shared by the slots and the program panel.
 * `toggle` plays/pauses (resuming where it stopped), `seek` jumps to a time and plays.
 */
export type Preview = {
  /** Preview of a patch; `disabled` when it was edited and the audio is of its original version. */
  lookup: (ref: { side: 'source' | 'destination'; slot: number }, program: A2Program) => PreviewLink | undefined
  playing: string | null
  toggle: (url: string) => void
  seek: (url: string, time: number) => void
  /** The shared audio element, to read the position of the current preview. */
  element: () => HTMLAudioElement | null
}

export type PreviewLink = { url: string; disabled: boolean }

export type Waveform = { peaks: number[]; duration: number }

/** One bar per bucket of samples: its loudest sample across channels, scaled so the loudest bar is 1. */
export function computePeaks(channels: Float32Array[], bars: number): number[] {
  const length = channels[0]?.length ?? 0
  if (!length || bars < 1) return []
  const size = Math.ceil(length / bars)
  const peaks = Array.from({ length: Math.ceil(length / size) }, (_, bar) => {
    let peak = 0
    for (const data of channels) {
      for (let i = bar * size, end = Math.min(length, i + size); i < end; i += 1) peak = Math.max(peak, Math.abs(data[i]))
    }
    return peak
  })
  const loudest = Math.max(...peaks)
  return loudest > 0 ? peaks.map((p) => p / loudest) : peaks
}

const waveforms = new Map<string, Promise<Waveform>>()

/** Decodes a preview once (Web Audio, offline: no sound, no autoplay rules) and caches its peaks. */
export function loadWaveform(url: string, bars = 120): Promise<Waveform> {
  let waveform = waveforms.get(url)
  if (!waveform) {
    waveform = fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(data))
      .then((buffer) => ({
        peaks: computePeaks(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)), bars),
        duration: buffer.duration,
      }))
    waveform.catch(() => waveforms.delete(url))
    waveforms.set(url, waveform)
  }
  return waveform
}
