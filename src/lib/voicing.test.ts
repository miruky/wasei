import { describe, expect, it } from 'vitest';
import { midiToPitchClass } from './notes';
import { voiceChord, voiceLead } from './voicing';

describe('voiceChord', () => {
  it('C4を基準にCメジャーを密集配置する', () => {
    expect(voiceChord(0, 'maj', { octave: 4 })).toEqual([60, 64, 67]);
  });

  it('G7を綴る', () => {
    expect(voiceChord(7, '7', { octave: 4 })).toEqual([67, 71, 74, 77]);
  });

  it('テンションは上に積む', () => {
    // Cadd9: C E G D(1オクターブ上)
    expect(voiceChord(0, 'add9', { octave: 4 })).toEqual([60, 64, 67, 74]);
  });

  it('ベース音はルートの1オクターブ下に付く', () => {
    expect(voiceChord(0, 'maj', { octave: 4, bass: true })).toEqual([48, 60, 64, 67]);
  });

  it('構成音のピッチクラスは保たれる', () => {
    const pcs = voiceChord(2, 'm7', { octave: 4 }).map(midiToPitchClass);
    expect(new Set(pcs)).toEqual(new Set([2, 5, 9, 0]));
  });
});

describe('voiceLead', () => {
  it('前のコードがなければ密集配置のまま', () => {
    expect(voiceLead(null, 0, 'maj', { octave: 4 })).toEqual([60, 64, 67]);
  });

  it('前のコードに音域を寄せて跳躍を抑える', () => {
    const prev = [60, 64, 67]; // C4 メジャー
    // 素のBメジャー(octave4)は B4 D#5 F#5 で上にずれる。下げて寄せる。
    const led = voiceLead(prev, 11, 'maj', { octave: 4 });
    expect(led).toEqual([59, 63, 66]); // B3 D#4 F#4
  });

  it('寄せても構成音のピッチクラスは変わらない', () => {
    const led = voiceLead([60, 64, 67], 5, 'maj', { octave: 4 });
    const pcs = led.map(midiToPitchClass);
    expect(new Set(pcs)).toEqual(new Set([5, 9, 0]));
  });
});
