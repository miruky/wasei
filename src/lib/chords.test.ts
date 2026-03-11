import { describe, expect, it } from 'vitest';
import {
  chordSemitones,
  chordSymbol,
  chordTones,
  getQuality,
  matchQuality,
  QUALITIES,
} from './chords';

describe('getQuality', () => {
  it('idで引け、未知idは例外', () => {
    expect(getQuality('maj7').intervals).toEqual([0, 4, 7, 11]);
    expect(() => getQuality('nope')).toThrow();
  });

  it('idは重複しない', () => {
    const ids = QUALITIES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('間隔は昇順で0始まり', () => {
    for (const q of QUALITIES) {
      expect(q.intervals[0]).toBe(0);
      const sorted = [...q.intervals].sort((a, b) => a - b);
      expect(q.intervals).toEqual(sorted);
    }
  });
});

describe('chordTones', () => {
  it('Cメジャーは C E G', () => {
    expect(chordTones(0, 'maj')).toEqual([0, 4, 7]);
  });

  it('A マイナーは A C E', () => {
    expect(chordTones(9, 'min')).toEqual([9, 0, 4]);
  });

  it('G7 は G B D F', () => {
    expect(chordTones(7, '7')).toEqual([7, 11, 2, 5]);
  });

  it('テンションはオクターブを畳んで重複を除く', () => {
    // add9 の 9th(14半音=2)は重複しないので残る
    expect(chordTones(0, 'add9')).toEqual([0, 4, 7, 2]);
  });
});

describe('chordSemitones', () => {
  it('オクターブ情報を保ったまま返す', () => {
    expect(chordSemitones(0, '9')).toEqual([0, 4, 7, 10, 14]);
  });
});

describe('chordSymbol', () => {
  it('メジャーは接尾辞なし', () => {
    expect(chordSymbol(0, 'maj')).toBe('C');
  });

  it('クオリティの接尾辞が付く', () => {
    expect(chordSymbol(2, 'm7')).toBe('Dm7');
    expect(chordSymbol(7, '7')).toBe('G7');
  });

  it('フラット表記に追従する', () => {
    expect(chordSymbol(10, 'maj', 'flat')).toBe('Bb');
    expect(chordSymbol(10, 'maj', 'sharp')).toBe('A#');
  });
});

describe('matchQuality', () => {
  it('間隔集合からクオリティを逆引きする', () => {
    expect(matchQuality([0, 4, 7])).toBe('maj');
    expect(matchQuality([0, 3, 7])).toBe('min');
    expect(matchQuality([0, 3, 6])).toBe('dim');
  });

  it('順序やオクターブがずれても一致する', () => {
    expect(matchQuality([7, 0, 4])).toBe('maj');
    expect(matchQuality([12, 16, 19])).toBe('maj');
  });

  it('該当なしはnull', () => {
    expect(matchQuality([0, 1, 2])).toBeNull();
  });
});
