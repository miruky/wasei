// 音高まわりの純粋な計算。12平均律のピッチクラス(0=C .. 11=B)を基準に、
// 音名の表記(シャープ/フラット)、MIDIノート番号、周波数を相互に変換する。
// DOMにもWeb Audioにも触れない。

/** 0..11 に丸める。負の数や12以上でも正しいピッチクラスへ畳む */
export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type Accidental = 'sharp' | 'flat';

/** ピッチクラスを音名にする。表記の好みで C#4 と Db4 を切り替える */
export function pitchClassName(pc: number, accidental: Accidental = 'sharp'): string {
  const table = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  return table[mod12(pc)] ?? 'C';
}

const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * 音名(例 "C", "F#", "Bb", "C##", "Dbb")をピッチクラスへ。
 * 解釈できなければ null。共有URLや入力の解析に使う。
 */
export function parseNoteName(name: string): number | null {
  const match = /^([A-Ga-g])([#b♯♭]*)$/.exec(name.trim());
  if (!match) return null;
  const letter = match[1]!.toUpperCase();
  const base = LETTER_PC[letter];
  if (base === undefined) return null;
  let shift = 0;
  for (const ch of match[2]!) {
    if (ch === '#' || ch === '♯') shift += 1;
    else if (ch === 'b' || ch === '♭') shift -= 1;
  }
  return mod12(base + shift);
}

/** MIDIノート番号(C4=60)を周波数(Hz)へ。69=A4=440Hz を基準にする */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** MIDIノート番号のピッチクラス */
export function midiToPitchClass(midi: number): number {
  return mod12(midi);
}

/** ピッチクラスと科学的オクターブ(C4=オクターブ4)からMIDIノート番号を作る */
export function pitchClassToMidi(pc: number, octave: number): number {
  return (octave + 1) * 12 + mod12(pc);
}
