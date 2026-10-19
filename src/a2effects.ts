/**
 * Effect tables from the Korg A2 MIDI implementation (A2MIDI.TXT): "Group No. of chains"
 * and "Groups (Disp to Internal data)". Values are internal bytes; formatters turn them
 * into what the A2 displays.
 */

/** `min`/`max` are the valid internal values ("value (int)" column of the Korg tables). */
export type ParamDef = { label: string; format: (v: number) => string; min: number; max: number }
export type EffectGroup = { name: string; variants: string[]; params: (ParamDef | null)[] }

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const fixed = (n: number, digits = 1) => n.toFixed(digits)

type Format = Omit<ParamDef, 'min' | 'max'>
const raw = (label: string): Format => ({ label, format: (v) => `${v}` })
/** Bipolar value shown with its sign (dB, feedback, balance…). */
const offset = (label: string, by: number, unit = ''): Format => ({ label, format: (v) => `${signed(v - by)}${unit}` })
/** Unipolar value stored with an offset: display = internal + add. */
const plus = (label: string, add: number, unit = ''): Format => ({ label, format: (v) => `${v + add}${unit}` })
const db = (label: string) => offset(label, 12, ' dB')
const fbak = (label = 'FBAK') => offset(label, 100)
const scaled = (label: string, factor: number, unit: string, digits = 0): Format => ({ label, format: (v) => `${fixed(v * factor, digits)}${unit}` })
const speed = (label = 'SPD') => scaled(label, 1 / 20, ' Hz', 2)
const ms10 = (label: string) => scaled(label, 10, ' ms')
const fine = (label = 'FINE') => scaled(label, 0.1, ' ms', 1)
const khz = (label: string, add: number) => ({ label, format: (v: number) => `${fixed((v + add) / 20, 2)} kHz` })
const q = (label = 'Q') => ({ label, format: (v: number) => fixed(v / 2 + 2) })
const list = (label: string, options: string[]): Format => ({ label, format: (v) => options[v] ?? `${v}` })
const XCIT_FREQ = ['1.9', '2.1', '2.3', '2.7', '3.1', '3.7', '4.6', '6.2', '9.3', '18.6'].map((f) => `${f} kHz`)
const limiterRel = (label = 'REL'): Format => ({ label, format: (v) => (v >= 99 ? '30.0' : fixed(v * 0.3)) })
const twoRange = (label: string, split: number, add: number): Format => ({ label, format: (v) => `${fixed(v < split ? v / 10 : v - add, 1)} ms` })
const pan = (label: string): Format => ({ label, format: (v) => (v === 25 ? 'C' : v < 25 ? `L${(25 - v) * 2}` : `R${(v - 25) * 2}`) })
const ebal = () => raw('EBAL')
const p = (...params: (Format | null)[]): (ParamDef | null)[] => [...params, ...Array(6 - params.length).fill(null)] as (ParamDef | null)[]

export const EFFECT_GROUPS: Record<string, EffectGroup> = {
  1: { name: 'Reverb', variants: ['RM1', 'RM2', 'HL1', 'HL2', 'PL1', 'PL2'], params: p(scaled('RevT', 0.1, ' s', 1), raw('DAMP'), scaled('PreD', 1, ' ms'), db('L.EQ'), db('H.EQ'), ebal()) },
  2: { name: 'Compressor', variants: ['COMP'], params: p(plus('SENS', -2), raw('ATCK'), raw('LEVL')) },
  3: { name: 'Distortion', variants: ['DST1', 'DST2', 'OVD1', 'OVD2'], params: p(raw('DRIV'), raw('LEVL'), khz('FREQ', 8), db('GAIN'), q()) },
  4: { name: 'Delay', variants: ['DLY1', 'DLY2', 'DLY3'], params: p(ms10('TIME'), fine(), fbak(), raw('DAMP'), null, ebal()) },
  5: { name: 'Stereo Delay', variants: ['SDLY', 'XDLY'], params: p(ms10('DT-L'), fbak('FB-L'), ms10('DT-R'), fbak('FB-R'), raw('DAMP'), ebal()) },
  6: { name: 'Modulation Delay', variants: ['MDL1', 'MDL2'], params: p(ms10('TIME'), fine(), fbak(), speed(), raw('DPTH'), ebal()) },
  7: { name: 'Modulation', variants: ['CHO1', 'CHO2', 'FLN1', 'FLN2'], params: p(speed(), raw('DPTH'), fbak(), scaled('TIME', 1, ' ms'), fine(), ebal()) },
  8: { name: 'Rotary Speaker', variants: ['R.SP'], params: p(raw('DPTH'), offset('RATO', 10), list('SEL', ['LOW', 'HIGH'])) },
  9: { name: 'Auto Pan', variants: ['PAN1', 'PAN2'], params: p(speed(), raw('DPTH')) },
  10: { name: 'Parametric EQ', variants: ['P.EQ'], params: p(khz('L-Fc', 2), db('GAIN'), khz('R-Fc', 8), db('GAIN'), q()) },
  11: { name: 'Pitch Shifter', variants: ['PTCH'], params: p({ label: 'PTCH', format: (v) => `${signed(v * 5 - 100)} cent` }, null, null, null, null, ebal()) },
  12: { name: 'Exciter', variants: ['XCIT'], params: p(offset('BLND', 100), list('FREQ', XCIT_FREQ)) },
  13: { name: 'Ensemble', variants: ['ENS'], params: p(speed(), raw('DPTH'), scaled('PreD', 0.2, ' ms', 1), null, null, ebal()) },
  14: { name: 'Phaser', variants: ['PHA1', 'PHA2'], params: p(speed(), raw('DPTH'), raw('MANU'), null, null, raw('RESO')) },
  15: { name: '3-Band EQ', variants: ['EQ'], params: p(khz('L-Fc', 2), db('GAIN'), khz('M-Fc', 8), db('GAIN'), khz('H-Fc', 20), db('GAIN')) },
  16: { name: 'Speaker Simulator', variants: ['SP1', 'SP2', 'SP3'], params: p(list('FAT', ['OFF', 'ON']), list('BRIT', ['OFF', 'ON'])) },
  17: { name: 'Pedal Pan', variants: ['PAN'], params: p(raw('DPTH')) },
  18: { name: 'Gate', variants: ['GATE'], params: p(raw('LEVL'), raw('ATCK'), raw('REL'), scaled('PreD', 1, ' ms')) },
  19: { name: 'Pedal Wah', variants: ['WAH'], params: p() },
  20: { name: 'Early Reflection', variants: ['ER1', 'ER2', 'ER3'], params: p(scaled('TIME', 5, ' ms'), scaled('PreD', 1, ' ms'), db('L.EQ'), db('H.EQ'), null, ebal()) },
  21: { name: 'Hard Distortion', variants: ['HDST', 'TOD'], params: p(raw('DRIV'), raw('LEVL'), db('BASS'), khz('M-Fc', 8), db('MID'), db('TRBL')) },
  22: { name: 'Auto Wah', variants: ['WAH1', 'WAH2'], params: p(raw('SENS'), raw('FC'), raw('RESO'), raw('ATCK'), raw('REL')) },
  23: { name: 'Space Phaser', variants: ['SPH1', 'SPH2'], params: p(speed(), raw('DPTH'), raw('MANU'), raw('RESO')) },
  24: { name: 'Multi-Tap Delay', variants: ['MTD1', 'MTD2', 'MTD3', 'MTD4', 'MTD5', 'MTD6'], params: p(ms10('DT-L'), ms10('DT-R'), ms10('FB-T'), fbak('FB-G'), raw('AMB'), ebal()) },
  25: { name: 'Long Delay', variants: ['LDLY1', 'LDLY2', 'LDLY3'], params: p(ms10('TIME'), fine(), fbak(), raw('DAMP'), null, ebal()) },
  26: {
    name: 'Tempo Delay', variants: ['TDLY'],
    params: p(plus('TEMP', 40), list('NOTE', ['1/2', '1/4D', '1/4', '1/8D', '1/4T', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64', '1/64T']), { label: 'AJST', format: (v) => `${signed((v - 100) / 10)}%` }, fbak(), raw('DAMP'), ebal()),
  },
  27: { name: 'Dynamic Modulation', variants: ['DMD1', 'DMD2', 'PMD1', 'PMD2'], params: p(raw('ATCK'), raw('REL'), raw('DPTH'), fbak(), twoRange('TIME', 200, 180), ebal()) },
  28: { name: '4ch Mixer', variants: ['MIXR'], params: p(raw('LVL1'), pan('PAN1'), raw('LVL2'), pan('PAN2'), raw('LVL3'), raw('LVL4')) },
  29: { name: 'Gate 2', variants: ['GAT1', 'GAT2'], params: p(raw('LEVL'), raw('ATCK'), ms10('HLDT'), raw('REL'), scaled('PreD', 1, ' ms')) },
  30: { name: 'Limiter', variants: ['LIM'], params: p(raw('THR'), raw('RATO'), raw('ATCK'), limiterRel(), null, raw('LEVL')) },
  31: { name: 'Band Chorus', variants: ['BCH1', 'BCH2', 'BCH3', 'BCH4'], params: p(speed('SPDL'), raw('DPTL'), { label: 'SPDH', format: (v) => (v === 0 ? 'SYNC' : `${fixed(v / 20, 2)} Hz`) }, raw('DPTH'), raw('MBAL'), ebal()) },
  32: { name: 'Stereo Exciter', variants: ['SXIT'], params: p(offset('BLNL', 100), list('FREL', XCIT_FREQ), offset('BLNR', 100), list('FRER', XCIT_FREQ)) },
  33: { name: 'Comp/Limiter', variants: ['C/LM'], params: p(raw('THR'), raw('RATO'), raw('ATCK'), limiterRel(), null, raw('LEVL')) },
  34: { name: 'Super Distortion', variants: ['SDS1', 'SDS2', 'SOD1', 'SOD2'], params: p(raw('DRIV'), raw('LEVL'), null, null, null, list('MODE', ['AMP1', 'AMP2', 'LINE'])) },
  35: { name: 'Hard Distortion 2', variants: ['HD2', 'TOD2'], params: p(raw('DRIV'), raw('LEVL')) },
  36: { name: 'New 3-Band EQ', variants: ['3BEQ'], params: p(db('BASS'), khz('M-Fc', 8), q('M-Q'), db('MID'), db('TRBL'), raw('TRIM')) },
  37: { name: 'Multi-Tap Chorus', variants: ['MTC1', 'MTC2'], params: p(speed(), raw('DPTH'), raw('FAT'), fbak(), plus('TIME', 1), ebal()) },
  "37'": { name: 'Multi-Tap Chorus (taps)', variants: ['TAPS'], params: p(...[1, 2, 3, 4, 5].map((n) => list(`TAP${n}`, ['OFF', 'Lch', 'L+R', 'Rch']))) },
  38: { name: 'Reverb 2', variants: ['RM3', 'HL3', 'PL3', 'SPRN'], params: p(scaled('RevT', 0.1, ' s', 1), plus('DAMP', -20, '%'), scaled('PreD', 1, ' ms'), scaled('RevD', 1, ' ms'), scaled('E/RB', 1, '%'), scaled('EBAL', 1, '%')) },
  "38'": { name: 'Reverb 2 (color)', variants: ['COLOR'], params: p(scaled('EAmb', 1, '%'), scaled('RAmb', 1, '%'), null, null, db('L.EQ'), db('H.EQ')) },
  39: { name: 'Driver', variants: ['DRV1', 'DRV2', 'DRV3', 'DRV4'], params: p(raw('DRIV'), raw('LEVL')) },
  40: { name: 'Rotary Speaker 2 (color)', variants: ['RSP2'], params: p(plus('TONE', 1), list('AMB', ['MONO', 'ST0', 'ST1', 'ST2', 'ST3', 'ST4']), null, raw('BAL')) },
  "40'": { name: 'Rotary Speaker 2', variants: ['RSP2'], params: p(list('SPD', ['LOW', 'HIGH']), offset('Lspd', 5), offset('Hspd', 5), offset('RATO', 3), plus('WEIT', 1)) },
  41: { name: 'Modulation 2', variants: ['CHO3', 'CHO4', 'FLN3', 'FLN4'], params: p(speed(), offset('DPTH', 100), fbak(), twoRange('EDLY', 100, 90), twoRange('DDLY', 100, 90), ebal()) },
  42: { name: 'Stereo Comp/Limiter L', variants: ['LIM L'], params: p(raw('THR'), raw('RATO'), raw('ATCK'), raw('REL'), list('MODE', ['DUAL', 'LNK1', 'LNK2']), raw('LEVL')) },
  43: { name: 'Stereo Comp/Limiter R', variants: ['LIM R'], params: p(raw('THR'), raw('RATO'), raw('ATCK'), raw('REL'), null, raw('LEVL')) },
  44: { name: 'Stereo Pitch Shifter/Delay', variants: ['SPT1', 'SPT2'], params: p(scaled('DT-L', 2, ' ms'), raw('FB-L'), scaled('DT-R', 2, ' ms'), raw('FB-R'), { label: 'PTCH', format: (v) => `${signed(v * 2 - 100)} cent` }, ebal()) },
  45: { name: 'Spatial Reverb', variants: ['SRM1', 'SRM2', 'SHL1', 'SHL2', 'SPL1', 'SPL2'], params: p(scaled('RevT', 0.1, ' s', 1), plus('DAMP', -20), scaled('PreD', 1, ' ms'), raw('ICFM'), raw('OCFM'), ebal()) },
}

/** Valid internal range of each parameter, in the same order as the group's params. */
const PARAM_RANGES: Record<string, ([number, number] | null)[]> = {
  1: [[1, 50], [0, 99], [0, 100], [0, 24], [0, 24], [0, 100]],
  2: [[2, 102], [0, 20], [0, 100]],
  3: [[0, 100], [0, 100], [3, 152], [0, 24], [0, 16]],
  4: [[0, 80], [0, 99], [1, 199], [0, 99], null, [0, 100]],
  5: [[0, 40], [1, 199], [0, 40], [1, 199], [0, 99], [0, 100]],
  6: [[0, 50], [0, 99], [1, 199], [1, 200], [0, 100], [0, 100]],
  7: [[1, 200], [0, 100], [1, 199], [0, 50], [0, 9], [0, 100]],
  8: [[0, 99], [0, 20], [0, 1]],
  9: [[1, 200], [0, 100]],
  10: [[0, 38], [0, 24], [3, 152], [0, 24], [0, 16]],
  11: [[0, 40], null, null, null, null, [0, 100]],
  12: [[0, 200], [0, 9]],
  13: [[1, 200], [0, 100], [0, 250], null, null, [0, 100]],
  14: [[1, 200], [0, 100], [0, 100], null, null, [0, 99]],
  15: [[0, 38], [0, 24], [3, 152], [0, 24], [0, 140], [0, 24]],
  16: [[0, 1], [0, 1]],
  17: [[0, 100]],
  18: [[0, 99], [0, 99], [0, 99], [0, 50]],
  19: [],
  20: [[1, 100], [0, 100], [0, 24], [0, 24], null, [0, 100]],
  21: [[0, 100], [0, 100], [0, 24], [3, 152], [0, 24], [0, 24]],
  22: [[0, 100], [0, 100], [0, 99], [1, 20], [1, 20]],
  23: [[1, 200], [0, 100], [0, 100], [0, 99]],
  24: [[0, 80], [0, 80], [0, 80], [1, 199], [0, 20], [0, 100]],
  25: [[0, 160], [0, 99], [1, 199], [0, 99], null, [0, 100]],
  26: [[0, 152], [0, 12], [1, 199], [1, 199], [0, 99], [0, 100]],
  27: [[1, 20], [1, 20], [0, 100], [1, 199], [0, 230], [0, 100]],
  28: [[0, 100], [0, 50], [0, 100], [0, 50], [0, 100], [0, 100]],
  29: [[0, 99], [0, 50], [0, 160], [0, 50], [0, 50]],
  30: [[0, 99], [0, 100], [0, 30], [0, 99], null, [0, 100]],
  31: [[1, 200], [0, 100], [0, 200], [0, 100], [0, 100], [0, 100]],
  32: [[0, 200], [0, 9], [0, 200], [0, 9]],
  33: [[0, 99], [0, 100], [0, 30], [0, 99], null, [0, 100]],
  34: [[0, 100], [0, 100], null, null, null, [0, 2]],
  35: [[0, 100], [0, 100]],
  36: [[0, 24], [3, 152], [0, 6], [0, 24], [0, 24], [0, 100]],
  37: [[1, 200], [0, 100], [0, 3], [1, 199], [0, 3], [0, 100]],
  "37'": [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3]],
  38: [[1, 50], [20, 100], [0, 200], [0, 200], [0, 100], [0, 100]],
  "38'": [[0, 100], [0, 100], null, null, [0, 24], [0, 24]],
  39: [[0, 100], [0, 100]],
  40: [[0, 9], [0, 5], null, [0, 100]],
  "40'": [[0, 1], [0, 10], [0, 10], [0, 6], [0, 2]],
  41: [[1, 200], [0, 200], [1, 199], [0, 140], [0, 140], [0, 100]],
  42: [[0, 99], [0, 100], [0, 100], [0, 100], [0, 2], [0, 100]],
  43: [[0, 99], [0, 100], [0, 100], [0, 100], null, [0, 100]],
  44: [[0, 200], [0, 99], [0, 200], [0, 99], [0, 100], [0, 100]],
  45: [[1, 50], [20, 100], [0, 100], [0, 100], [0, 100], [0, 100]],
}

for (const [key, group] of Object.entries(EFFECT_GROUPS)) {
  group.params.forEach((param, i) => {
    const range = PARAM_RANGES[key]?.[i]
    if (!param) return
    if (!range) throw new Error(`Range mancante per il gruppo ${key}, parametro ${i}`)
    param.min = range[0]
    param.max = range[1]
  })
}

/** Internal chains 1–97: effect group of each of the 8 FX slots ("-" = unused slot). */
const CHAIN_TABLE = `
01: 2 3 - - 12 4 7 1|02: 2 15 12 - 4 7 1 -|03: 19 3 15 - 12 6 1 -|04: 2 3 - - 12 4 9 1|05: 2 3 - - 12 4 14 1
06: 3 12 5 - 13 1 - -|07: 3 12 16 - 4 7 1 -|08: 3 15 19 - 16 6 1 -|09: 2 3 - - 12 19 6 1|10: 12 11 6 - 9 5 1 -
11: 10 2 12 18 11 1 - -|12: 10 2 15 - 4 1 18 -|13: 3 12 6 - 11 5 5 -|14: 2 12 11 - 20 1 - -|15: 3 4 12 - 1 8 - -
16: 2 15 12 5 13 1 - -|17: 15 11 12 - 4 7 1 -|18: 2 11 - - 15 12 4 1|19: 2 15 4 - 1 11 17 -|20: 2 11 12 - 1 8 - -
21: 3 22 - - 12 4 7 1|22: 21 12 - - 4 7 1 -|23: 21 25 - - 20 1 - -|24: 21 12 - - 7 5 1 -|25: 2 12 23 - 15 24 1 -
26: 21 12 - - 23 24 5 -|27: 21 12 - - 2 5 1 -|28: 21 25 - - - 11 1 -|29: 21 12 - - 19 4 7 5|30: 2 11 12 - 24 1 - -
31: 12 11 26 - 38 38' - -|32: 15 11 5 - 38 38' - -|33: 2 12 26 7 38 38' - -|34: 1 4 7 - 38 38' - -|35: 2 12 1 - 27 7 5 -
36: 1 27 - - 5 12 1 28|37: 20 5 28 - 38 38' - -|38: 12 11 - - 11 5 7 28|39: 15 5 5 28 38 38' - -|40: 29 - - - 1 1 - -
41: 2 15 12 - 31 5 - -|42: 4 31 - - 20 1 - -|43: 12 31 - - 5 1 - -|44: 2 15 12 - 24 1 - -|45: 12 11 24 - 13 1 - -
46: 2 11 12 - 24 7 5 -|47: 10 30 15 12 20 1 - -|48: 10 30 15 4 13 1 - -|49: 15 4 7 32 5 1 - -|50: 12 11 4 - 5 1 7 -
51: 33 35 - - 36 4 1 -|52: 33 34 - - 36 12 4 13|53: 33 34 - - 36 12 4 20|54: 33 34 - - 36 16 4 7|55: 33 34 - - 36 4 37 37'
56: 33 34 - - 35 36 5 -|57: 35 36 - - 16 6 1 -|58: 35 36 - - 6 1 28 -|59: 33 36 - - 5 37 37' 28|60: 33 36 12 - 37 37' 1 -
61: 7 24 28 - 38 38' - -|62: 15 4 7 5 38 38' - -|63: 12 4 13 - 38 38' - -|64: 15 12 5 - 7 7 28 -|65: 2 10 12 7 38 38' - -
66: 15 1 12 - 5 20 28 -|67: 15 6 12 - 24 1 28 -|68: 15 6 - - 6 12 1 28|69: 39 40 - - 40' - - -|70: 15 12 6 9 38 38' - -
71: 17 2 2 - - 12 6 1|72: 17 2 2 - 6 6 1 -|73: 17 2 2 - 6 - 12 1|74: 17 2 7 - - 12 4 1|75: 2 12 1 - 27 - 1 -
76: 35 36 - - 27 - 1 -|77: 12 6 1 - 33 6 1 -|78: 12 6 1 - - 4 7 1|79: 4 12 1 - - 4 11 1|80: 12 6 1 - - 20 1 -
81: 12 6 1 - - 1 1 -|82: 32 44 - - 24 24 28 -|83: 32 44 - - 41 5 1 -|84: 32 41 41 - 5 1 - -|85: 32 4 4 - 41 1 28 -
86: 32 15 15 5 45 - - -|87: 32 15 15 5 38 38' - -|88: 41 41 28 - 45 - - -|89: 41 41 28 - 38 38' - -|90: 32 41 5 - 45 - - -
91: 32 41 5 - 38 38' - -|92: 32 44 - - 45 - - -|93: 32 44 - - 38 38' - -|94: 32 13 - - 45 - - -|95: 32 13 - - 38 38' - -
96: 42 43 - - 45 - - -|97: 42 43 - - 38 38' - -`

export const INTERNAL_CHAINS: Record<number, (string | null)[]> = Object.fromEntries(
  CHAIN_TABLE.split(/[|\n]/).filter(Boolean).map((entry) => {
    const [num, groups] = entry.split(':')
    return [Number(num), groups.trim().split(/\s+/).map((g) => (g === '-' ? null : g))]
  }),
)

/**
 * External chains also use effects built into the A2, by an internal block id. The A2
 * documentation does not list these ids: this mapping is inferred from the parameter
 * ranges used by the factory cards. Unmapped ids are shown as raw values.
 */
export const INTERNAL_BLOCK_GROUPS: Record<number, string> = {
  0x01: '19', 0x02: '4', 0x03: '6', 0x04: '3', 0x05: '5', 0x06: '7', 0x07: '1', 0x09: '12', 0x0c: '13', 0x0d: '2',
  0x0e: '9', 0x10: '18', 0x12: '15', 0x13: '16', 0x14: '11', 0x16: '10', 0x17: '20',
}

/** Card effect modules carry their own names: map them to the documented group for value formatting. */
export const MODULE_NAME_GROUPS: [RegExp, string][] = [
  [/^eXCITer/, '12'], [/^H DiST|^Tube\|OD/, '21'], [/^SPHase/, '23'], [/^L DLy/, '25'], [/^MT Dly/, '24'], [/^WAH\d/, '22'],
  [/^[SX]\.DLY/, '5'], [/^Spr (DS|OD)/, '34'], [/^3Bnd EQ/, '36'], [/^Cmp\/LMt/, '33'], [/^H Dist2|^T OvrD2/, '35'],
  [/^MT Cho/, '37'], [/^>>taps/, "37'"], [/^MIXer/, '28'], [/^ENSembl/, '13'], [/^BCH\d/, '31'], [/^LIMiTer/, '30'],
  [/^S eXcIT/, '32'], [/^E\.Ref/, '20'], [/^(RooM|HalL|PLate)\|/, '38'], [/^>>color/, "38'"], [/^COLoR/, '40'], [/^R\.SPk2/, "40'"], [/^DRiVer/, '39'],
]
