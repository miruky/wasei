import { describe, expect, it } from 'vitest';
import { progressionText } from './format';
import { defaultProgression, transpose } from './progression';

describe('progressionText', () => {
  it('調・テンポ・コード・度数を3行で書き出す', () => {
    const text = progressionText(defaultProgression());
    const [header, chords, romans] = text.split('\n');
    expect(header).toBe('C メジャー / 100 BPM');
    expect(chords).toBe('C | G | Am | F');
    expect(romans).toBe('I | V | vi | IV');
  });

  it('移調すると調名とコード名が一緒に動く', () => {
    const text = progressionText(transpose(defaultProgression(), 2));
    const [header, chords] = text.split('\n');
    expect(header).toContain('D メジャー');
    expect(chords).toBe('D | A | Bm | G');
  });

  it('空の進行でも調の行は残す', () => {
    const text = progressionText({ ...defaultProgression(), slots: [] });
    expect(text).toContain('C メジャー / 100 BPM');
    expect(text).toContain('(コードなし)');
  });
});
