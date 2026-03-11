import { describe, expect, it } from 'vitest';
import {
  midiToFreq,
  midiToPitchClass,
  mod12,
  parseNoteName,
  pitchClassName,
  pitchClassToMidi,
} from './notes';

describe('mod12', () => {
  it('負の数も0..11へ畳む', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(12)).toBe(0);
    expect(mod12(25)).toBe(1);
  });
});

describe('pitchClassName', () => {
  it('既定はシャープ表記', () => {
    expect(pitchClassName(1)).toBe('C#');
    expect(pitchClassName(6)).toBe('F#');
  });

  it('フラット表記に切り替えられる', () => {
    expect(pitchClassName(1, 'flat')).toBe('Db');
    expect(pitchClassName(10, 'flat')).toBe('Bb');
  });

  it('白鍵はどちらでも同じ', () => {
    expect(pitchClassName(0)).toBe('C');
    expect(pitchClassName(4, 'flat')).toBe('E');
  });
});

describe('parseNoteName', () => {
  it('白鍵と臨時記号を読む', () => {
    expect(parseNoteName('C')).toBe(0);
    expect(parseNoteName('F#')).toBe(6);
    expect(parseNoteName('Bb')).toBe(10);
  });

  it('重臨時記号と異名同音を畳む', () => {
    expect(parseNoteName('C##')).toBe(2);
    expect(parseNoteName('Dbb')).toBe(0);
    expect(parseNoteName('Cb')).toBe(11);
  });

  it('Unicodeの♯♭も読む', () => {
    expect(parseNoteName('G♯')).toBe(8);
    expect(parseNoteName('A♭')).toBe(8);
  });

  it('解釈できない入力はnull', () => {
    expect(parseNoteName('H')).toBeNull();
    expect(parseNoteName('')).toBeNull();
  });
});

describe('midiToFreq', () => {
  it('A4(69)は440Hz、オクターブ差は倍々', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 4);
    expect(midiToFreq(57)).toBeCloseTo(220, 4);
  });
});

describe('midi と pitchClass の往復', () => {
  it('C4=60、ピッチクラスは0', () => {
    expect(pitchClassToMidi(0, 4)).toBe(60);
    expect(midiToPitchClass(60)).toBe(0);
    expect(midiToPitchClass(61)).toBe(1);
  });

  it('オクターブを上げると12ずつ増える', () => {
    expect(pitchClassToMidi(9, 4)).toBe(69);
    expect(pitchClassToMidi(9, 5)).toBe(81);
  });
});
