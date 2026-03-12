// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from './app';

function setup(): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  mountApp(root);
  return root;
}

// Node 25 の実験的localStorageが空のグローバルを差し込むため、テスト中は素朴な
// メモリ実装へ差し替える。アプリは素の localStorage(=globalThis)を見る。
function installStorage(): Storage {
  const mem = new Map<string, string>();
  const fake: Storage = {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => void mem.delete(k),
    setItem: (k, v) => void mem.set(k, String(v)),
  };
  (globalThis as { localStorage: Storage }).localStorage = fake;
  return fake;
}

let storage: Storage;

beforeEach(() => {
  storage = installStorage();
  location.hash = '';
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('初期描画', () => {
  it('五度圏は外周12+内周12の24スライス', () => {
    const root = setup();
    expect(root.querySelectorAll('.wedge')).toHaveLength(24);
  });

  it('ダイアトニックは7和音、進行は既定の4コード', () => {
    const root = setup();
    expect(root.querySelectorAll('.chip')).toHaveLength(7);
    expect(root.querySelectorAll('.slot')).toHaveLength(4);
  });

  it('中心に現在のキーを表示する', () => {
    const root = setup();
    expect(root.querySelector('.center-key')?.textContent).toBe('C');
  });
});

describe('進行の編集', () => {
  it('ダイアトニックのクリックでコードが増える', () => {
    const root = setup();
    root.querySelector<HTMLButtonElement>('.chip')!.click();
    expect(root.querySelectorAll('.slot')).toHaveLength(5);
  });

  it('削除ボタンでコードが減る', () => {
    const root = setup();
    root.querySelector<HTMLButtonElement>('.icon-btn.danger')!.click();
    expect(root.querySelectorAll('.slot')).toHaveLength(3);
  });

  it('クリアで空になり、案内が出る', () => {
    const root = setup();
    const clear = [...root.querySelectorAll<HTMLButtonElement>('.ghost')].find((b) =>
      b.textContent?.includes('クリア'),
    )!;
    clear.click();
    expect(root.querySelectorAll('.slot')).toHaveLength(0);
    expect(root.querySelector('.empty')).not.toBeNull();
  });
});

describe('キーと移調', () => {
  it('半音上げると表示キーがDbになる', () => {
    const root = setup();
    const up = [...root.querySelectorAll<HTMLButtonElement>('.icon-btn')].find(
      (b) => b.getAttribute('aria-label') === '半音上げる',
    )!;
    up.click();
    expect(root.querySelector('.center-key')?.textContent).toBe('Db');
  });

  it('プリセットを選ぶと進行が差し替わる', () => {
    const root = setup();
    const select = [...root.querySelectorAll<HTMLSelectElement>('select')].find((s) =>
      [...s.options].some((o) => o.value === 'blues'),
    )!;
    select.value = 'blues';
    select.dispatchEvent(new Event('change'));
    expect(root.querySelectorAll('.slot')).toHaveLength(12);
  });
});

describe('永続化', () => {
  it('編集するとURLハッシュとlocalStorageへ保存される', () => {
    const root = setup();
    root.querySelector<HTMLButtonElement>('.chip')!.click();
    expect(location.hash.startsWith('#p=')).toBe(true);
    expect(storage.getItem('wasei:progression')).not.toBeNull();
  });
});
