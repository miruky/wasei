// コード進行のデータモデル。1コマ(スロット)はルート・クオリティ・拍数を持ち、
// 進行は調・テンポ・スロット列からなる。移調、編集、再生スケジュールの計算を
// すべて純粋関数で扱い、UIとエンジンはこれらを呼ぶだけにする。

import { mod12 } from './notes';
import type { Mode } from './circle';

export interface Slot {
  readonly rootPc: number;
  readonly qualityId: string;
  /** このコマの長さ(拍) */
  readonly beats: number;
}

export interface Progression {
  readonly keyPc: number;
  readonly mode: Mode;
  /** テンポ(1分あたりの拍数) */
  readonly tempo: number;
  readonly slots: readonly Slot[];
}

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 240;

export function clampTempo(tempo: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(tempo)));
}

/** 既定の進行。Cメジャーの王道進行(I-V-vi-IV) */
export function defaultProgression(): Progression {
  return {
    keyPc: 0,
    mode: 'major',
    tempo: 100,
    slots: [
      { rootPc: 0, qualityId: 'maj', beats: 4 },
      { rootPc: 7, qualityId: 'maj', beats: 4 },
      { rootPc: 9, qualityId: 'min', beats: 4 },
      { rootPc: 5, qualityId: 'maj', beats: 4 },
    ],
  };
}

/** 進行全体を半音単位で移調する。調も構成音も一緒に動く */
export function transpose(prog: Progression, semitones: number): Progression {
  return {
    ...prog,
    keyPc: mod12(prog.keyPc + semitones),
    slots: prog.slots.map((s) => ({ ...s, rootPc: mod12(s.rootPc + semitones) })),
  };
}

export function setKey(prog: Progression, keyPc: number, mode: Mode): Progression {
  return { ...prog, keyPc: mod12(keyPc), mode };
}

export function setTempo(prog: Progression, tempo: number): Progression {
  return { ...prog, tempo: clampTempo(tempo) };
}

export function addSlot(prog: Progression, slot: Slot): Progression {
  return { ...prog, slots: [...prog.slots, slot] };
}

export function removeSlotAt(prog: Progression, index: number): Progression {
  return { ...prog, slots: prog.slots.filter((_, i) => i !== index) };
}

export function updateSlotAt(prog: Progression, index: number, patch: Partial<Slot>): Progression {
  return {
    ...prog,
    slots: prog.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  };
}

/** スロットを from から to へ移す。範囲外なら元のまま */
export function moveSlot(prog: Progression, from: number, to: number): Progression {
  const slots = [...prog.slots];
  if (from < 0 || from >= slots.length || to < 0 || to >= slots.length) return prog;
  const [moved] = slots.splice(from, 1);
  slots.splice(to, 0, moved!);
  return { ...prog, slots };
}

export function totalBeats(slots: readonly Slot[]): number {
  return slots.reduce((sum, s) => sum + s.beats, 0);
}

export interface ScheduledSlot {
  readonly index: number;
  readonly slot: Slot;
  /** 開始時刻(秒。startTime基準) */
  readonly start: number;
  /** 長さ(秒) */
  readonly duration: number;
}

/** スロット列をテンポに従って秒単位の時刻へ並べる。再生スケジュールの素 */
export function scheduleSlots(
  slots: readonly Slot[],
  tempo: number,
  startTime = 0,
): ScheduledSlot[] {
  const secondsPerBeat = 60 / tempo;
  let cursor = startTime;
  return slots.map((slot, index) => {
    const duration = slot.beats * secondsPerBeat;
    const start = cursor;
    cursor += duration;
    return { index, slot, start, duration };
  });
}

/** 進行1周の長さ(秒) */
export function loopDuration(prog: Progression): number {
  return totalBeats(prog.slots) * (60 / prog.tempo);
}

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly progression: Progression;
}

function major(slots: Slot[], tempo = 100): Progression {
  return { keyPc: 0, mode: 'major', tempo, slots };
}

const beat4 = (rootPc: number, qualityId: string): Slot => ({ rootPc, qualityId, beats: 4 });

// Cメジャーを基準にした定番進行。利用側で移調して使う。
export const PRESETS: readonly Preset[] = [
  {
    id: 'oudou',
    name: '王道進行 (I-V-vi-IV)',
    progression: major([beat4(0, 'maj'), beat4(7, 'maj'), beat4(9, 'min'), beat4(5, 'maj')]),
  },
  {
    id: 'komuro',
    name: '小室進行 (vi-IV-V-I)',
    progression: major([beat4(9, 'min'), beat4(5, 'maj'), beat4(7, 'maj'), beat4(0, 'maj')]),
  },
  {
    id: 'fifties',
    name: '50年代進行 (I-vi-IV-V)',
    progression: major([beat4(0, 'maj'), beat4(9, 'min'), beat4(5, 'maj'), beat4(7, 'maj')]),
  },
  {
    id: 'twofive',
    name: 'ツーファイブワン (ii-V-I)',
    progression: major(
      [
        { rootPc: 2, qualityId: 'm7', beats: 4 },
        { rootPc: 7, qualityId: '7', beats: 4 },
        { rootPc: 0, qualityId: 'maj7', beats: 8 },
      ],
      120,
    ),
  },
  {
    id: 'junkan',
    name: '循環コード (Imaj7-vi7-ii7-V7)',
    progression: major(
      [
        { rootPc: 0, qualityId: 'maj7', beats: 4 },
        { rootPc: 9, qualityId: 'm7', beats: 4 },
        { rootPc: 2, qualityId: 'm7', beats: 4 },
        { rootPc: 7, qualityId: '7', beats: 4 },
      ],
      120,
    ),
  },
  {
    id: 'canon',
    name: 'カノン進行',
    progression: major([
      beat4(0, 'maj'),
      beat4(7, 'maj'),
      beat4(9, 'min'),
      beat4(4, 'min'),
      beat4(5, 'maj'),
      beat4(0, 'maj'),
      beat4(5, 'maj'),
      beat4(7, 'maj'),
    ]),
  },
  {
    id: 'blues',
    name: '12小節ブルース',
    progression: major(
      [
        beat4(0, '7'),
        beat4(0, '7'),
        beat4(0, '7'),
        beat4(0, '7'),
        beat4(5, '7'),
        beat4(5, '7'),
        beat4(0, '7'),
        beat4(0, '7'),
        beat4(7, '7'),
        beat4(5, '7'),
        beat4(0, '7'),
        beat4(7, '7'),
      ],
      132,
    ),
  },
];
