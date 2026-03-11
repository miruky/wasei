// 五度圏と調(キー)の和声。五度圏は12の調を完全五度ずつ並べた輪で、隣り合う調は
// 調号が1つだけ違う。ここでは輪の並び・相対調・ダイアトニックコード・ローマ数字を、
// すべてピッチクラスの計算から導く。

import { matchQuality, getQuality } from './chords';
import { type Accidental, mod12, pitchClassName } from './notes';

export type Mode = 'major' | 'minor';

// メジャー/ナチュラルマイナーのスケール(主音からの半音)。
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
export const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;

/** 主音と旋法から7音のピッチクラスを得る */
export function scalePitchClasses(tonicPc: number, mode: Mode): number[] {
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  return steps.map((s) => mod12(tonicPc + s));
}

/** あるメジャー調が五度圏上の何番目か(C=0、時計回りにG,D,...)。7の逆元も7なので積で求まる */
export function circleIndexOfMajor(majorPc: number): number {
  return mod12(majorPc * 7);
}

/** メジャー調に対する平行調(相対的短調)の主音。短三度下=9半音上 */
export function relativeMinorPc(majorPc: number): number {
  return mod12(majorPc + 9);
}

/** 短調に対する平行調(相対的長調)の主音 */
export function relativeMajorPc(minorPc: number): number {
  return mod12(minorPc + 3);
}

export interface CircleSlice {
  /** 五度圏上の位置(0=C、時計回り) */
  readonly index: number;
  readonly majorPc: number;
  readonly minorPc: number;
  readonly majorLabel: string;
  readonly minorLabel: string;
  /** Cからの五度の数。シャープ側が正、フラット側が負 */
  readonly fifths: number;
}

// 異名同音の継ぎ目(位置6)は両表記を併記する。下半分はフラットで綴るのが通例。
const MAJOR_LABELS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const MINOR_LABELS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m/E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];

export const CIRCLE: readonly CircleSlice[] = MAJOR_LABELS.map((majorLabel, index) => {
  const majorPc = mod12(index * 7);
  return {
    index,
    majorPc,
    minorPc: relativeMinorPc(majorPc),
    majorLabel,
    minorLabel: MINOR_LABELS[index]!,
    fifths: index <= 6 ? index : index - 12,
  };
});

/** その調を五線譜で綴るときシャープ寄りかフラット寄りか。コード名の表記に使う */
export function accidentalForKey(tonicPc: number, mode: Mode): Accidental {
  const majorPc = mode === 'major' ? tonicPc : relativeMajorPc(tonicPc);
  return circleIndexOfMajor(majorPc) <= 6 ? 'sharp' : 'flat';
}

/** 五度圏上で主音の位置を示す角度(度)。0時を上(-90度)に、時計回りに30度ずつ */
export function circleAngle(index: number): number {
  return index * 30 - 90;
}

export interface DiatonicChord {
  /** 1始まりの音度 */
  readonly degree: number;
  readonly rootPc: number;
  readonly qualityId: string;
  readonly roman: string;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const MINORISH = new Set(['min', 'm7', 'm6', 'm9', 'mMaj7', 'dim', 'dim7', 'm7b5']);

// 音度とクオリティからローマ数字表記を作る。マイナー系は小文字、減・増は記号で示す。
function romanLabel(degreeIndex: number, qualityId: string, accidentalPrefix = ''): string {
  const base = MINORISH.has(qualityId) ? ROMAN[degreeIndex]!.toLowerCase() : ROMAN[degreeIndex]!;
  let suffix = getQuality(qualityId).symbol;
  if (qualityId === 'min' || qualityId === 'm7' || qualityId === 'm6' || qualityId === 'm9' || qualityId === 'mMaj7') {
    suffix = suffix.replace(/^m/, ''); // 小文字が短和音を表すので接頭のmは落とす
  }
  if (qualityId === 'dim') suffix = '°';
  else if (qualityId === 'dim7') suffix = '°7';
  else if (qualityId === 'm7b5') suffix = 'ø7';
  else if (qualityId === 'aug') suffix = '+';
  return accidentalPrefix + base + suffix;
}

function diatonicChord(scale: number[], degreeIndex: number, withSeventh: boolean): DiatonicChord {
  const root = scale[degreeIndex]!;
  const third = scale[(degreeIndex + 2) % 7]!;
  const fifth = scale[(degreeIndex + 4) % 7]!;
  const intervals = [0, mod12(third - root), mod12(fifth - root)];
  if (withSeventh) intervals.push(mod12(scale[(degreeIndex + 6) % 7]! - root));
  const qualityId = matchQuality(intervals) ?? 'maj';
  return {
    degree: degreeIndex + 1,
    rootPc: root,
    qualityId,
    roman: romanLabel(degreeIndex, qualityId),
  };
}

/** 調のダイアトニック三和音7つを音度順に返す */
export function diatonicTriads(tonicPc: number, mode: Mode): DiatonicChord[] {
  const scale = scalePitchClasses(tonicPc, mode);
  return scale.map((_, i) => diatonicChord(scale, i, false));
}

/** 調のダイアトニック四和音(七の和音)7つを音度順に返す */
export function diatonicSevenths(tonicPc: number, mode: Mode): DiatonicChord[] {
  const scale = scalePitchClasses(tonicPc, mode);
  return scale.map((_, i) => diatonicChord(scale, i, true));
}

/**
 * 任意のコードを調の中でローマ数字解析する。ダイアトニックなら綺麗な数字、
 * 外れていれば最寄りの音度に♭/♯を付けて示す。7音スケールでは必ず解決する。
 */
export function romanNumeralInKey(rootPc: number, qualityId: string, tonicPc: number, mode: Mode): string {
  const scale = scalePitchClasses(tonicPc, mode);
  const exact = scale.indexOf(mod12(rootPc));
  if (exact >= 0) return romanLabel(exact, qualityId);
  // 上の音度の半音下(♭)を優先し、なければ下の音度の半音上(♯)
  for (let d = 0; d < 7; d++) {
    if (mod12(scale[d]! - rootPc) === 1) return romanLabel(d, qualityId, '♭');
  }
  for (let d = 0; d < 7; d++) {
    if (mod12(rootPc - scale[d]!) === 1) return romanLabel(d, qualityId, '♯');
  }
  return pitchClassName(rootPc); // 理論上到達しない
}
