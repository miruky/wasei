// 進行を人が読める/貼り付けられるテキストへ書き出す。共有リンクとは別に、
// コードシートやメモへそのまま残せる形を返す。

import { chordSymbol } from './chords';
import { accidentalForKey, romanNumeralInKey } from './circle';
import { pitchClassName } from './notes';
import type { Progression } from './progression';

const modeName = (mode: Progression['mode']): string =>
  mode === 'major' ? 'メジャー' : 'マイナー';

/** 進行をテキスト化する。1行目に調とテンポ、2行目にコード、3行目に度数。 */
export function progressionText(prog: Progression): string {
  const acc = accidentalForKey(prog.keyPc, prog.mode);
  const header = `${pitchClassName(prog.keyPc, acc)} ${modeName(prog.mode)} / ${prog.tempo} BPM`;
  if (prog.slots.length === 0) return `${header}\n(コードなし)`;
  const symbols = prog.slots.map((slot) => chordSymbol(slot.rootPc, slot.qualityId, acc));
  const romans = prog.slots.map((slot) =>
    romanNumeralInKey(slot.rootPc, slot.qualityId, prog.keyPc, prog.mode),
  );
  return `${header}\n${symbols.join(' | ')}\n${romans.join(' | ')}`;
}
