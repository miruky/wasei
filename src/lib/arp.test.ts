import { describe, expect, it } from 'vitest';
import { buildArpeggio } from './arp';

describe('buildArpeggio', () => {
  it('刻みで等分し、音を下から循環させる', () => {
    const events = buildArpeggio([60, 64, 67], 2, 0.5, 1);
    expect(events.map((e) => e.midi)).toEqual([60, 64, 67, 60]);
    expect(events.map((e) => e.start)).toEqual([0, 0.5, 1, 1.5]);
    expect(events.every((e) => e.duration === 0.5)).toBe(true);
  });

  it('gateで発音長を刻みより短くする', () => {
    const [first] = buildArpeggio([60], 1, 1, 0.9);
    expect(first!.duration).toBeCloseTo(0.9, 6);
  });

  it('刻みが長さより大きくても最低1音は鳴る', () => {
    const events = buildArpeggio([60, 64], 0.3, 1);
    expect(events).toHaveLength(1);
    expect(events[0]!.midi).toBe(60);
  });

  it('音が無い・長さが0なら空', () => {
    expect(buildArpeggio([], 2, 0.5)).toEqual([]);
    expect(buildArpeggio([60], 0, 0.5)).toEqual([]);
  });
});
