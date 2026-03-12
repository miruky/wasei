// 線画のSVGアイコン。currentColorで色をテーマに追従させ、装飾なので aria-hidden を付ける。
// 文字列で返し、ボタンの innerHTML に差し込んで使う。

const PATHS: Readonly<Record<string, string>> = {
  play: '<path d="M7 5.2 18.5 12 7 18.8Z" fill="currentColor" stroke="none" />',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />',
  loop: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" /><path d="M4 20v-4h4" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  minus: '<path d="M5 12h14" />',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />',
  left: '<path d="M14 7l-5 5 5 5" />',
  right: '<path d="M10 7l5 5-5 5" />',
  link: '<path d="M9 14a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66L10.5 6.5" /><path d="M15 10a4 4 0 0 0-5.66 0L6.5 12.84a4 4 0 0 0 5.66 5.66L13.5 17.5" />',
  shuffle: '<path d="M4 6h3.5L17 18h3" /><path d="M17 6h3M4 18h3.5L11 13" /><path d="M17 4l3 2-3 2M17 16l3 2-3 2" />',
  check: '<path d="M5 12.5 10 17 19 7" />',
  music: '<path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />',
};

export function icon(name: keyof typeof PATHS): string {
  return (
    `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" ` +
    `stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${PATHS[name]}</svg>`
  );
}

export type IconName = keyof typeof PATHS;
