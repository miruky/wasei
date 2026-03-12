// localStorageの薄いラッパ。プライベートモードや無効化された環境でも例外で落ちないよう、
// 読み書きは握りつぶして null/false を返す。進行は共有用の文字列のまま保存する。

const KEY = 'wasei:progression';

export function saveString(value: string): boolean {
  try {
    localStorage.setItem(KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function loadString(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 失敗しても支障はない
  }
}
