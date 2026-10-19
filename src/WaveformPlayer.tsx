import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { useT } from './i18n'
import { PauseIcon, PlayIcon } from './icons'
import { type Preview, type Waveform, loadWaveform } from './previews'

const BAR = 3 // bar width + gap, in viewBox units
const HEIGHT = 40

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/**
 * Waveform of a preview with play/pause, position and time. Uses the shared player, so it
 * follows a preview started from a slot. Click or drag on the waveform to seek.
 */
export function WaveformPlayer({ url, name, preview, disabled = false, notice }: { url: string; name: string; preview: Preview; disabled?: boolean; notice?: string }) {
  const t = useT()
  const [waveform, setWaveform] = useState<Waveform | null>(null)
  const [failed, setFailed] = useState(false)
  const [time, setTime] = useState(0)
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const isPlaying = !disabled && preview.playing === url

  // A patch edited while its preview plays: stop it, the audio no longer matches the patch.
  useEffect(() => {
    if (disabled && preview.playing === url) preview.toggle(url)
  }, [disabled])

  useEffect(() => {
    let active = true
    setWaveform(null)
    setFailed(false)
    loadWaveform(url).then((w) => active && setWaveform(w), () => active && setFailed(true))
    return () => { active = false }
  }, [url])

  // Follow the shared player: every frame while playing, once when paused on this file.
  useEffect(() => {
    const read = () => {
      const element = preview.element()
      setTime(element?.dataset.url === url ? element.currentTime : 0)
    }
    read()
    if (!isPlaying) return
    let frame = requestAnimationFrame(function tick() {
      read()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, url])

  const duration = waveform?.duration ?? 0
  const progress = duration ? Math.min(1, time / duration) : 0

  function seekTo(clientX: number) {
    const rect = svg.current?.getBoundingClientRect()
    if (!rect || !duration || disabled) return
    const target = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration
    setTime(target)
    preview.seek(url, target)
  }

  function onKey(e: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key]
    if (step === undefined || !duration || disabled) return
    e.preventDefault()
    const target = Math.min(duration - 0.05, Math.max(0, time + step))
    setTime(target)
    preview.seek(url, target)
  }

  const width = (waveform?.peaks.length ?? 120) * BAR
  return (
    <div className={`waveform-player ${isPlaying ? 'playing' : ''} ${disabled ? 'disabled' : ''}`} aria-disabled={disabled || undefined}>
      <button className="icon-only waveform-toggle" disabled={disabled} onClick={() => preview.toggle(url)} aria-label={`${isPlaying ? t.pausePreview : t.playPreview}: ${name}`} title={isPlaying ? t.pausePreview : t.playPreview}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="waveform-area">
      <svg
        ref={svg}
        className="waveform"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={t.previewPosition}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} / ${clock(duration)}`}
        aria-busy={!waveform && !failed}
        onPointerDown={(e: PointerEvent<SVGSVGElement>) => { if (disabled) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekTo(e.clientX) }}
        onPointerMove={(e) => { if (dragging.current) seekTo(e.clientX) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={onKey}
      >
        <title>{waveform ? `${clock(time)} / ${clock(duration)}` : t.loadingWaveform}</title>
        {(waveform?.peaks ?? Array<number>(120).fill(0.04)).map((peak, i) => {
          const h = Math.max(1.5, peak * (HEIGHT - 4))
          return <rect key={i} className={(i + 0.5) / (width / BAR) <= progress ? 'played' : undefined} x={i * BAR} y={(HEIGHT - h) / 2} width={BAR - 1} height={h} rx={0.6} />
        })}
        {progress > 0 && <rect className="playhead" x={progress * width - 0.5} y={0} width={1} height={HEIGHT} />}
      </svg>
      {notice && <span className="waveform-notice">{notice}</span>}
      </div>
      <span className="waveform-time">{clock(time)} / {clock(duration)}</span>
    </div>
  )
}
