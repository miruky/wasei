import { describe, expect, it } from 'vitest';
import { decodeProgression, encodeProgression } from './share';
import { defaultProgression, PRESETS, transpose } from './progression';

describe('encode と decode の往復', () => {
  it('既定の進行を復元できる', () => {
    const prog = defaultProgression();
    const restored = decodeProgression(encodeProgression(prog));
    expect(restored).toEqual(prog);
  });

  it('移調や調変更も保たれる', () => {
    const prog = transpose({ ...defaultProgression(), mode: 'minor' }, 5);
    expect(decodeProgression(encodeProgression(prog))).toEqual(prog);
  });

  it('全プリセットが往復する', () => {
    for (const preset of PRESETS) {
      expect(decodeProgression(encodeProgression(preset.progression))).toEqual(preset.progression);
    }
  });
});

describe('decodeProgression の頑健さ', () => {
  it('先頭の # や p= を許す', () => {
    const encoded = encodeProgression(defaultProgression());
    expect(decodeProgression(`#p=${encoded}`)).toEqual(defaultProgression());
  });

  it('形式が違えば null', () => {
    expect(decodeProgression('')).toBeNull();
    expect(decodeProgression('1|0|M|100')).toBeNull();
    expect(decodeProgression('2|0|M|100|0-maj-4')).toBeNull(); // 未知バージョン
  });

  it('範囲外の値は弾く', () => {
    expect(decodeProgression('1|12|M|100|0-maj-4')).toBeNull(); // keyPc>11
    expect(decodeProgression('1|0|M|9999|0-maj-4')).toBeNull(); // tempo過大
    expect(decodeProgression('1|0|X|100|0-maj-4')).toBeNull(); // 不正な旋法
  });

  it('未知のクオリティや不正な拍を弾く', () => {
    expect(decodeProgression('1|0|M|100|0-bogus-4')).toBeNull();
    expect(decodeProgression('1|0|M|100|0-maj-0')).toBeNull();
  });
});
