// コードのピッチクラスを実際に鳴らすMIDIノートへ展開する。基本は密集配置で
// ルートの上に構成音を積み、必要ならベース音を足す。連続するコードの跳躍を抑える
// ボイスリーディングも純粋関数として用意する。

import { chordSemitones } from './chords';
import { pitchClassToMidi } from './notes';

export interface VoiceOptions {
  /** ルートを置く科学的オクターブ(C4=4) */
  readonly octave?: number;
  /** ルートの1オクターブ下にベース音を足す */
  readonly bass?: boolean;
}

/** ルートの上に構成音を密集配置で積んだMIDIノート列 */
export function voiceChord(rootPc: number, qualityId: string, options: VoiceOptions = {}): number[] {
  const octave = options.octave ?? 4;
  const rootMidi = pitchClassToMidi(rootPc, octave);
  // chordSemitones は 0 始まりの昇順なので、ルートに足すだけで密集配置になる。
  const tones = chordSemitones(rootPc, qualityId).map((semi) => rootMidi + (semi - rootPc));
  return options.bass ? [rootMidi - 12, ...tones] : tones;
}

function mean(notes: readonly number[]): number {
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}

/**
 * 直前のボイシングに音域を寄せる。密集配置をオクターブ単位で上下させ、
 * 平均音高が前のコードに最も近くなる位置を選ぶ。跳躍を抑えて滑らかにつなぐ。
 */
export function voiceLead(
  prev: readonly number[] | null,
  rootPc: number,
  qualityId: string,
  options: VoiceOptions = {},
): number[] {
  const base = voiceChord(rootPc, qualityId, options);
  if (!prev || prev.length === 0) return base;
  const target = mean(prev);
  let best = base;
  let bestGap = Math.abs(mean(base) - target);
  for (const shift of [-12, 12]) {
    const moved = base.map((n) => n + shift);
    const gap = Math.abs(mean(moved) - target);
    if (gap < bestGap) {
      best = moved;
      bestGap = gap;
    }
  }
  return best;
}
