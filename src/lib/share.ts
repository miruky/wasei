// 進行をURLで共有するためのエンコード/デコード。状態を短い文字列に畳んでハッシュに
// 載せ、開いたときに復元する。壊れた入力は黙って捨てられるよう厳密に検証する。

import { QUALITIES } from './chords';
import type { Mode } from './circle';
import { clampTempo, MAX_TEMPO, MIN_TEMPO, type Progression, type Slot } from './progression';

const VERSION = '1';
const VALID_QUALITY = new Set(QUALITIES.map((q) => q.id));
const MAX_BEATS = 64;
const MAX_SLOTS = 64;

/** 進行を共有用の文字列にする(先頭の # は付けない) */
export function encodeProgression(prog: Progression): string {
  const mode = prog.mode === 'minor' ? 'm' : 'M';
  const slots = prog.slots
    .map((s) => `${s.rootPc}-${s.qualityId}-${s.beats}`)
    .join(',');
  return [VERSION, prog.keyPc, mode, prog.tempo, slots].join('|');
}

/** 共有用の文字列から進行を復元する。形式が不正なら null */
export function decodeProgression(input: string): Progression | null {
  const body = input.replace(/^#/, '').replace(/^p=/, '');
  const parts = body.split('|');
  if (parts.length !== 5) return null;
  const [version, keyRaw, modeRaw, tempoRaw, slotsRaw] = parts;
  if (version !== VERSION) return null;

  const keyPc = toInt(keyRaw);
  if (keyPc === null || keyPc < 0 || keyPc > 11) return null;

  if (modeRaw !== 'M' && modeRaw !== 'm') return null;
  const mode: Mode = modeRaw === 'm' ? 'minor' : 'major';

  const tempo = toInt(tempoRaw);
  if (tempo === null || tempo < MIN_TEMPO || tempo > MAX_TEMPO) return null;

  const slots = parseSlots(slotsRaw ?? '');
  if (!slots || slots.length === 0) return null;

  return { keyPc, mode, tempo: clampTempo(tempo), slots };
}

function parseSlots(raw: string): Slot[] | null {
  const entries = raw.split(',');
  if (entries.length > MAX_SLOTS) return null;
  const slots: Slot[] = [];
  for (const entry of entries) {
    const fields = entry.split('-');
    if (fields.length !== 3) return null;
    const rootPc = toInt(fields[0]!);
    const qualityId = fields[1]!;
    const beats = toInt(fields[2]!);
    if (rootPc === null || rootPc < 0 || rootPc > 11) return null;
    if (!VALID_QUALITY.has(qualityId)) return null;
    if (beats === null || beats < 1 || beats > MAX_BEATS) return null;
    slots.push({ rootPc, qualityId, beats });
  }
  return slots;
}

function toInt(value: string | undefined): number | null {
  if (value === undefined || !/^-?\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}
