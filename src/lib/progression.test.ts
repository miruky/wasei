import { describe, expect, it } from 'vitest';
import {
  addSlot,
  clampTempo,
  defaultProgression,
  loopDuration,
  moveSlot,
  PRESETS,
  removeSlotAt,
  scheduleSlots,
  setKey,
  totalBeats,
  transpose,
  updateSlotAt,
  type Slot,
} from './progression';

const slot = (rootPc: number, qualityId: string, beats: number): Slot => ({ rootPc, qualityId, beats });

describe('clampTempo', () => {
  it('範囲外を丸め、小数は整数化', () => {
    expect(clampTempo(10)).toBe(40);
    expect(clampTempo(300)).toBe(240);
    expect(clampTempo(99.6)).toBe(100);
  });
});

describe('transpose', () => {
  it('調も全スロットも一緒に動く', () => {
    const moved = transpose(defaultProgression(), 2); // C -> D
    expect(moved.keyPc).toBe(2);
    expect(moved.slots.map((s) => s.rootPc)).toEqual([2, 9, 11, 7]);
  });

  it('12を超えても循環する', () => {
    expect(transpose(defaultProgression(), 12).slots[0]!.rootPc).toBe(0);
  });
});

describe('編集ヘルパは元を壊さない', () => {
  it('addSlotは末尾に足した新しい進行を返す', () => {
    const base = defaultProgression();
    const next = addSlot(base, slot(2, 'm7', 4));
    expect(next.slots).toHaveLength(5);
    expect(base.slots).toHaveLength(4);
  });

  it('removeSlotAtは指定位置を除く', () => {
    const next = removeSlotAt(defaultProgression(), 1);
    expect(next.slots.map((s) => s.rootPc)).toEqual([0, 9, 5]);
  });

  it('updateSlotAtは差分だけ当てる', () => {
    const next = updateSlotAt(defaultProgression(), 0, { qualityId: 'maj7', beats: 2 });
    expect(next.slots[0]).toEqual({ rootPc: 0, qualityId: 'maj7', beats: 2 });
  });

  it('moveSlotは並べ替え、範囲外は無視', () => {
    const next = moveSlot(defaultProgression(), 0, 2);
    expect(next.slots.map((s) => s.rootPc)).toEqual([7, 9, 0, 5]);
    expect(moveSlot(defaultProgression(), 0, 9)).toEqual(defaultProgression());
  });

  it('setKeyは調だけ変える', () => {
    const next = setKey(defaultProgression(), 9, 'minor');
    expect(next.keyPc).toBe(9);
    expect(next.mode).toBe('minor');
    expect(next.slots).toEqual(defaultProgression().slots);
  });
});

describe('scheduleSlots', () => {
  it('拍数とテンポから秒の時刻へ並べる', () => {
    const slots = [slot(0, 'maj', 4), slot(7, 'maj', 2)];
    const scheduled = scheduleSlots(slots, 120); // 120bpm => 0.5秒/拍
    expect(scheduled[0]).toMatchObject({ start: 0, duration: 2 });
    expect(scheduled[1]).toMatchObject({ start: 2, duration: 1 });
  });

  it('startTimeを足せる', () => {
    const scheduled = scheduleSlots([slot(0, 'maj', 4)], 60, 10);
    expect(scheduled[0]!.start).toBe(10);
    expect(scheduled[0]!.duration).toBe(4);
  });
});

describe('totalBeats / loopDuration', () => {
  it('拍の合計と1周の秒数', () => {
    const prog = defaultProgression(); // 4拍x4, 100bpm
    expect(totalBeats(prog.slots)).toBe(16);
    expect(loopDuration(prog)).toBeCloseTo(16 * (60 / 100), 6);
  });
});

describe('PRESETS', () => {
  it('idは重複せず、各進行に空でないスロットがある', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PRESETS) {
      expect(preset.progression.slots.length).toBeGreaterThan(0);
    }
  });

  it('ブルースは12小節', () => {
    const blues = PRESETS.find((p) => p.id === 'blues')!;
    expect(blues.progression.slots).toHaveLength(12);
  });
});
