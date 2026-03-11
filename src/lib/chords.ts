// コードの定義。各クオリティをルートからの半音間隔で表し、ルートのピッチクラスと
// 組み合わせて構成音やコードシンボルを導く。idは状態やURLに保存する安定キー、
// symbolは表示用、labelは読み上げ・メニュー用の和名。

import { mod12, type Accidental, pitchClassName } from './notes';

export interface Quality {
  /** 状態・URLに保存する安定した識別子 */
  readonly id: string;
  /** ルート名に付ける表示用の接尾辞(メジャーは空) */
  readonly symbol: string;
  /** メニューや読み上げに使う和名 */
  readonly label: string;
  /** ルート(0)からの半音間隔。昇順 */
  readonly intervals: readonly number[];
}

// 三和音から始め、よく使う四和音・テンション系までを一通り。配列順がメニュー順。
export const QUALITIES: readonly Quality[] = [
  { id: 'maj', symbol: '', label: 'メジャー', intervals: [0, 4, 7] },
  { id: 'min', symbol: 'm', label: 'マイナー', intervals: [0, 3, 7] },
  { id: 'dim', symbol: 'dim', label: 'ディミニッシュ', intervals: [0, 3, 6] },
  { id: 'aug', symbol: 'aug', label: 'オーギュメント', intervals: [0, 4, 8] },
  { id: 'sus2', symbol: 'sus2', label: 'サスペンデッド2nd', intervals: [0, 2, 7] },
  { id: 'sus4', symbol: 'sus4', label: 'サスペンデッド4th', intervals: [0, 5, 7] },
  { id: '6', symbol: '6', label: 'シックス', intervals: [0, 4, 7, 9] },
  { id: 'm6', symbol: 'm6', label: 'マイナー6th', intervals: [0, 3, 7, 9] },
  { id: '7', symbol: '7', label: 'ドミナント7th', intervals: [0, 4, 7, 10] },
  { id: 'maj7', symbol: 'maj7', label: 'メジャー7th', intervals: [0, 4, 7, 11] },
  { id: 'm7', symbol: 'm7', label: 'マイナー7th', intervals: [0, 3, 7, 10] },
  { id: 'm7b5', symbol: 'm7♭5', label: 'ハーフディミニッシュ', intervals: [0, 3, 6, 10] },
  { id: 'dim7', symbol: 'dim7', label: 'ディミニッシュ7th', intervals: [0, 3, 6, 9] },
  { id: 'mMaj7', symbol: 'mMaj7', label: 'マイナーメジャー7th', intervals: [0, 3, 7, 11] },
  { id: 'add9', symbol: 'add9', label: 'アドナインス', intervals: [0, 4, 7, 14] },
  { id: '9', symbol: '9', label: 'ナインス', intervals: [0, 4, 7, 10, 14] },
  { id: 'maj9', symbol: 'maj9', label: 'メジャー9th', intervals: [0, 4, 7, 11, 14] },
  { id: 'm9', symbol: 'm9', label: 'マイナー9th', intervals: [0, 3, 7, 10, 14] },
] as const;

const BY_ID = new Map(QUALITIES.map((q) => [q.id, q]));

/** idからクオリティを引く。未知のidは例外 */
export function getQuality(id: string): Quality {
  const q = BY_ID.get(id);
  if (!q) throw new Error(`未知のコードクオリティ: ${id}`);
  return q;
}

/** ルートのピッチクラスと半音間隔から、構成音のピッチクラスを重複なく昇順以外の登場順で返す */
export function chordTones(rootPc: number, qualityId: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const semi of getQuality(qualityId).intervals) {
    const pc = mod12(rootPc + semi);
    if (!seen.has(pc)) {
      seen.add(pc);
      out.push(pc);
    }
  }
  return out;
}

/** ルートからの絶対的な半音(オクターブ込み)。ボイシングで実音へ展開する素 */
export function chordSemitones(rootPc: number, qualityId: string): number[] {
  return getQuality(qualityId).intervals.map((semi) => rootPc + semi);
}

/** コードシンボル(例 "Cmaj7" "Dm7" "G7")を組み立てる */
export function chordSymbol(rootPc: number, qualityId: string, accidental: Accidental = 'sharp'): string {
  return pitchClassName(rootPc, accidental) + getQuality(qualityId).symbol;
}

/**
 * ルートからの間隔集合に一致するクオリティidを探す。一致しなければnull。
 * ダイアトニックコードの判定など、構成音からコード名を逆引きするのに使う。
 */
export function matchQuality(intervals: readonly number[]): string | null {
  const key = normalize(intervals);
  for (const q of QUALITIES) {
    if (normalize(q.intervals) === key) return q.id;
  }
  return null;
}

function normalize(intervals: readonly number[]): string {
  const set = new Set(intervals.map((n) => mod12(n)));
  return [...set].sort((a, b) => a - b).join(',');
}
