// アルペジオの時刻計算。コードの構成音を一定の刻みで順番に鳴らすため、
// 各音の開始時刻と長さ(コマ先頭からの相対秒)を組み立てる純粋関数。

export interface ArpEvent {
  readonly midi: number;
  /** コマ先頭からの開始秒 */
  readonly start: number;
  /** 鳴っている長さ(秒) */
  readonly duration: number;
}

/**
 * 音を下から順に繰り返し並べるアルペジオを作る。
 * totalDuration をできるだけ stepDuration 刻みで等分し、足りなければ先頭から循環する。
 * gate は刻みに対する発音長の割合(0..1)で、わずかに切ることで粒立ちを出す。
 */
export function buildArpeggio(
  notes: readonly number[],
  totalDuration: number,
  stepDuration: number,
  gate = 0.92,
): ArpEvent[] {
  if (notes.length === 0 || totalDuration <= 0 || stepDuration <= 0) return [];
  const steps = Math.max(1, Math.round(totalDuration / stepDuration));
  const step = totalDuration / steps;
  const events: ArpEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push({
      midi: notes[i % notes.length]!,
      start: i * step,
      duration: step * gate,
    });
  }
  return events;
}
