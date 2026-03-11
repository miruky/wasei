import { describe, expect, it } from 'vitest';
import {
  accidentalForKey,
  circleAngle,
  CIRCLE,
  circleIndexOfMajor,
  diatonicSevenths,
  diatonicTriads,
  relativeMajorPc,
  relativeMinorPc,
  romanNumeralInKey,
  scalePitchClasses,
} from './circle';

describe('五度圏の並び', () => {
  it('12スライスで主音は完全五度ずつ進む', () => {
    expect(CIRCLE).toHaveLength(12);
    expect(CIRCLE.map((s) => s.majorPc)).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]);
  });

  it('Cは0番、Gは1番、Fは11番', () => {
    expect(circleIndexOfMajor(0)).toBe(0);
    expect(circleIndexOfMajor(7)).toBe(1);
    expect(circleIndexOfMajor(5)).toBe(11);
  });

  it('五度の数はシャープ側が正、フラット側が負', () => {
    expect(CIRCLE[0]!.fifths).toBe(0); // C
    expect(CIRCLE[1]!.fifths).toBe(1); // G
    expect(CIRCLE[11]!.fifths).toBe(-1); // F
    expect(CIRCLE[7]!.fifths).toBe(-5); // Db
  });
});

describe('相対調', () => {
  it('Cの平行短調はA、その逆も成り立つ', () => {
    expect(relativeMinorPc(0)).toBe(9);
    expect(relativeMajorPc(9)).toBe(0);
  });
});

describe('scalePitchClasses', () => {
  it('Cメジャーは白鍵のみ', () => {
    expect(scalePitchClasses(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('Aナチュラルマイナーも白鍵のみ', () => {
    expect(scalePitchClasses(9, 'minor')).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });
});

describe('accidentalForKey', () => {
  it('シャープ側はsharp、フラット側はflat', () => {
    expect(accidentalForKey(7, 'major')).toBe('sharp'); // G
    expect(accidentalForKey(5, 'major')).toBe('flat'); // F
    expect(accidentalForKey(3, 'major')).toBe('flat'); // Eb
  });

  it('短調は平行長調の調号に従う', () => {
    expect(accidentalForKey(4, 'minor')).toBe('sharp'); // Em -> G major
    expect(accidentalForKey(2, 'minor')).toBe('flat'); // Dm -> F major
  });
});

describe('diatonicTriads', () => {
  it('Cメジャーは I ii iii IV V vi vii°', () => {
    const triads = diatonicTriads(0, 'major');
    expect(triads.map((t) => t.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(triads.map((t) => t.qualityId)).toEqual(['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']);
    expect(triads.map((t) => t.rootPc)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('Aマイナーは i ii° III iv v VI VII', () => {
    const triads = diatonicTriads(9, 'minor');
    expect(triads.map((t) => t.roman)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });
});

describe('diatonicSevenths', () => {
  it('Cメジャーの主要な七の和音', () => {
    const sevenths = diatonicSevenths(0, 'major');
    expect(sevenths.map((s) => s.qualityId)).toEqual([
      'maj7',
      'm7',
      'm7',
      'maj7',
      '7',
      'm7',
      'm7b5',
    ]);
    expect(sevenths[4]!.roman).toBe('V7');
    expect(sevenths[6]!.roman).toBe('viiø7');
  });
});

describe('romanNumeralInKey', () => {
  it('ダイアトニックは綺麗な数字', () => {
    expect(romanNumeralInKey(7, '7', 0, 'major')).toBe('V7');
    expect(romanNumeralInKey(9, 'min', 0, 'major')).toBe('vi');
  });

  it('非ダイアトニックは♭/♯付き', () => {
    expect(romanNumeralInKey(10, 'maj', 0, 'major')).toBe('♭VII'); // Bb in C major
    expect(romanNumeralInKey(3, 'maj', 0, 'major')).toBe('♭III'); // Eb in C major
  });

  it('セカンダリードミナントを近い音度で示す', () => {
    expect(romanNumeralInKey(2, '7', 0, 'major')).toBe('II7'); // D7 = V/V
  });
});

describe('circleAngle', () => {
  it('0番は真上(-90度)、3番は0度', () => {
    expect(circleAngle(0)).toBe(-90);
    expect(circleAngle(3)).toBe(0);
  });
});
