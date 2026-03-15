import './style.css';
import {
  accidentalForKey,
  CIRCLE,
  circleAngle,
  diatonicSevenths,
  diatonicTriads,
  type Mode,
  romanNumeralInKey,
} from './lib/circle';
import { chordSymbol, QUALITIES } from './lib/chords';
import { pitchClassName } from './lib/notes';
import {
  addSlot,
  defaultProgression,
  MAX_TEMPO,
  MIN_TEMPO,
  moveSlot,
  PRESETS,
  type Progression,
  removeSlotAt,
  setKey,
  setTempo,
  type Slot,
  totalBeats,
  transpose,
  updateSlotAt,
} from './lib/progression';
import { Player, type PlayMode } from './lib/engine';
import { progressionText } from './lib/format';
import { decodeProgression, encodeProgression } from './lib/share';
import { loadString, saveString } from './lib/storage';
import { icon } from './icons';

interface State {
  prog: Progression;
  use7th: boolean;
  playMode: PlayMode;
  loop: boolean;
  playing: boolean;
  current: number;
}

const MINORISH = new Set(['min', 'm7', 'm6', 'm9', 'mMaj7', 'dim', 'dim7', 'm7b5']);
const TONIC_LABELS = [
  'C',
  'C#/Db',
  'D',
  'D#/Eb',
  'E',
  'F',
  'F#/Gb',
  'G',
  'G#/Ab',
  'A',
  'A#/Bb',
  'B',
];
const SVG_NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number | boolean | null | undefined>;
interface ElOptions {
  class?: string;
  text?: string;
  html?: string;
  attrs?: Attrs;
  on?: Partial<Record<string, EventListener>>;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOptions = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v !== null && v !== undefined && v !== false)
        node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (opts.on) {
    for (const [k, v] of Object.entries(opts.on)) if (v) node.addEventListener(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined && v !== false)
      node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

const cosd = (deg: number): number => Math.cos((deg * Math.PI) / 180);
const sind = (deg: number): number => Math.sin((deg * Math.PI) / 180);
const round = (x: number): string => x.toFixed(2);

function annularSector(
  cx: number,
  cy: number,
  rO: number,
  rI: number,
  a0: number,
  a1: number,
): string {
  const x0o = cx + rO * cosd(a0);
  const y0o = cy + rO * sind(a0);
  const x1o = cx + rO * cosd(a1);
  const y1o = cy + rO * sind(a1);
  const x1i = cx + rI * cosd(a1);
  const y1i = cy + rI * sind(a1);
  const x0i = cx + rI * cosd(a0);
  const y0i = cy + rI * sind(a0);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return (
    `M${round(x0o)} ${round(y0o)}A${rO} ${rO} 0 ${large} 1 ${round(x1o)} ${round(y1o)}` +
    `L${round(x1i)} ${round(y1i)}A${rI} ${rI} 0 ${large} 0 ${round(x0i)} ${round(y0i)}Z`
  );
}

const isMinorish = (qualityId: string): boolean => MINORISH.has(qualityId);
const wedgeKey = (ring: 'major' | 'minor', pc: number): string => `${ring}:${pc}`;
const randInt = (max: number): number => Math.floor(Math.random() * max);

export function mountApp(root: HTMLElement): void {
  const player = new Player();
  const state: State = {
    prog: initialProgression(),
    use7th: false,
    playMode: 'pad',
    loop: true,
    playing: false,
    current: -1,
  };

  const wedges = new Map<string, SVGGElement>();
  let slotEls: HTMLElement[] = [];

  // ---- 永続化と共有 ----

  function persist(): void {
    const encoded = encodeProgression(state.prog);
    saveString(encoded);
    history.replaceState(null, '', `#p=${encoded}`);
  }

  function spell(pc: number): string {
    return pitchClassName(pc, accidentalForKey(state.prog.keyPc, state.prog.mode));
  }

  function symbolOf(slot: Slot): string {
    return chordSymbol(
      slot.rootPc,
      slot.qualityId,
      accidentalForKey(state.prog.keyPc, state.prog.mode),
    );
  }

  // ---- 状態更新 ----

  function commit(next: Progression, restart = true): void {
    state.prog = next;
    persist();
    renderCircle();
    renderKeyPanel();
    renderProgression();
    syncTransport();
    if (state.playing && restart) startPlayback();
  }

  function addChord(slot: Slot): void {
    player.preview(slot.rootPc, slot.qualityId);
    commit(addSlot(state.prog, slot), false);
  }

  // ---- 再生 ----

  function startPlayback(): void {
    player.mode = state.playMode;
    player.play(state.prog, {
      loop: state.loop,
      onStep: (index) => setCurrent(index),
      onEnd: () => {
        state.playing = false;
        setCurrent(-1);
        syncTransport();
      },
    });
    state.playing = true;
    syncTransport();
  }

  function togglePlay(): void {
    if (state.playing) {
      player.stop();
      state.playing = false;
      setCurrent(-1);
      syncTransport();
    } else if (state.prog.slots.length > 0) {
      void player.resume();
      startPlayback();
    }
  }

  function setCurrent(index: number): void {
    state.current = index;
    slotEls.forEach((node, i) => node.classList.toggle('is-playing', i === index));
    for (const node of wedges.values()) node.classList.remove('is-playing');
    const slot = state.prog.slots[index];
    if (slot) {
      const ring = isMinorish(slot.qualityId) ? 'minor' : 'major';
      wedges.get(wedgeKey(ring, slot.rootPc))?.classList.add('is-playing');
    }
  }

  // ---- 五度圏 ----

  function renderCircle(): void {
    wedges.clear();
    const size = 400;
    const cx = size / 2;
    const cy = size / 2;
    const board = svg('svg', {
      viewBox: `0 0 ${size} ${size}`,
      class: 'circle',
      role: 'group',
      'aria-label': '五度圏。和音をクリックすると進行に加わる',
    });

    // 外周(メジャー和音)・内周(マイナー和音)それぞれに乗るのは、その性質に一致する
    // ダイアトニック三和音だけ。減三和音(vii°など)はどちらの輪にも乗らない。
    const diatonic = diatonicTriads(state.prog.keyPc, state.prog.mode);
    const majorInKey = new Set(diatonic.filter((d) => d.qualityId === 'maj').map((d) => d.rootPc));
    const minorInKey = new Set(diatonic.filter((d) => d.qualityId === 'min').map((d) => d.rootPc));

    CIRCLE.forEach((slice) => {
      const angle = circleAngle(slice.index);
      board.append(
        buildWedge(
          'major',
          slice.majorPc,
          slice.majorLabel,
          angle,
          192,
          142,
          majorInKey.has(slice.majorPc),
        ),
      );
      board.append(
        buildWedge(
          'minor',
          slice.minorPc,
          slice.minorLabel,
          angle,
          138,
          94,
          minorInKey.has(slice.minorPc),
        ),
      );
    });

    board.append(buildCenter(cx, cy));
    circleHost.replaceChildren(board);
    setCurrent(state.current);
  }

  function buildWedge(
    ring: 'major' | 'minor',
    pc: number,
    label: string,
    angle: number,
    rO: number,
    rI: number,
    inKey: boolean,
  ): SVGGElement {
    const cx = 200;
    const cy = 200;
    const qualityId = ring === 'major' ? 'maj' : 'min';
    const tonic = state.prog.mode === 'major' ? ring === 'major' : ring === 'minor';
    const isTonic = inKey && tonic && pc === state.prog.keyPc;
    const labelMid = (rO + rI) / 2;
    const path = svg('path', {
      class: 'wedge-shape',
      d: annularSector(cx, cy, rO, rI, angle - 14, angle + 14),
    });
    const tx = cx + labelMid * cosd(angle);
    const ty = cy + labelMid * sind(angle);
    const text = svg('text', {
      class: 'wedge-label',
      x: round(tx),
      y: round(ty),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    text.textContent = label;
    const cls = ['wedge', `wedge-${ring}`];
    if (inKey) cls.push('in-key');
    if (isTonic) cls.push('tonic');
    const addLabel = `${pitchClassName(pc, accidentalForKey(state.prog.keyPc, state.prog.mode))}${ring === 'minor' ? 'マイナー' : 'メジャー'}を進行に追加`;
    const group = svg(
      'g',
      {
        class: cls.join(' '),
        role: 'button',
        tabindex: '0',
        'aria-label': addLabel,
      },
      [path, text],
    );
    const quality = state.use7th ? (ring === 'major' ? 'maj7' : 'm7') : qualityId;
    const add = (): void => addChord({ rootPc: pc, qualityId: quality, beats: 4 });
    group.addEventListener('click', add);
    group.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        add();
      }
    });
    wedges.set(wedgeKey(ring, pc), group);
    return group;
  }

  function buildCenter(cx: number, cy: number): SVGGElement {
    const tonicLabel = spell(state.prog.keyPc);
    const modeLabel = state.prog.mode === 'major' ? 'メジャー' : 'マイナー';
    const ring = svg('circle', { class: 'circle-center', cx, cy, r: 88 });
    const key = svg('text', { class: 'center-key', x: cx, y: cy - 6, 'text-anchor': 'middle' });
    key.textContent = tonicLabel;
    const mode = svg('text', { class: 'center-mode', x: cx, y: cy + 22, 'text-anchor': 'middle' });
    mode.textContent = modeLabel;
    return svg('g', { 'aria-hidden': 'true' }, [ring, key, mode]);
  }

  // ---- キーとダイアトニック ----

  function renderKeyPanel(): void {
    const tonicSelect = h('select', {
      class: 'field',
      attrs: { 'aria-label': 'キーの主音' },
      on: {
        change: (event) => {
          const pc = Number((event.target as HTMLSelectElement).value);
          commit(setKey(state.prog, pc, state.prog.mode), false);
        },
      },
    });
    TONIC_LABELS.forEach((label, pc) => {
      const option = h('option', { text: label, attrs: { value: pc } });
      if (pc === state.prog.keyPc) option.selected = true;
      tonicSelect.append(option);
    });

    const modeToggle = h(
      'div',
      { class: 'segmented', attrs: { role: 'group', 'aria-label': '旋法' } },
      [modeButton('メジャー', 'major'), modeButton('マイナー', 'minor')],
    );

    const seventhBtn = h('button', {
      class: 'toggle',
      attrs: { type: 'button', 'aria-pressed': state.use7th },
      text: '7thを使う',
      on: {
        click: () => {
          state.use7th = !state.use7th;
          renderCircle();
          renderKeyPanel();
        },
      },
    });

    const controls = h('div', { class: 'key-controls' }, [
      labeled('キー', tonicSelect),
      labeled('旋法', modeToggle),
      seventhBtn,
    ]);

    const chords = state.use7th
      ? diatonicSevenths(state.prog.keyPc, state.prog.mode)
      : diatonicTriads(state.prog.keyPc, state.prog.mode);
    const acc = accidentalForKey(state.prog.keyPc, state.prog.mode);
    const chips = h(
      'div',
      { class: 'diatonic', attrs: { role: 'group', 'aria-label': 'ダイアトニックコード' } },
      chords.map((chord, i) => {
        const chip = h(
          'button',
          {
            class: 'chip',
            attrs: { type: 'button' },
            on: {
              click: () => addChord({ rootPc: chord.rootPc, qualityId: chord.qualityId, beats: 4 }),
            },
          },
          [
            h('span', { class: 'chip-roman', text: chord.roman }),
            h('span', {
              class: 'chip-name',
              text: chordSymbol(chord.rootPc, chord.qualityId, acc),
            }),
          ],
        );
        chip.style.setProperty('--i', String(i));
        return chip;
      }),
    );

    keyHost.replaceChildren(controls, chips);
  }

  function modeButton(label: string, mode: Mode): HTMLButtonElement {
    return h('button', {
      class: 'seg' + (state.prog.mode === mode ? ' is-active' : ''),
      text: label,
      attrs: { type: 'button', 'aria-pressed': state.prog.mode === mode },
      on: { click: () => commit(setKey(state.prog, state.prog.keyPc, mode), false) },
    });
  }

  // ---- 進行 ----

  function renderProgression(): void {
    const beats = totalBeats(state.prog.slots);
    const meta = h('p', {
      class: 'prog-meta',
      text: `${state.prog.slots.length}コード ・ ${beats}拍`,
    });

    if (state.prog.slots.length === 0) {
      slotEls = [];
      progHost.replaceChildren(
        meta,
        h('p', {
          class: 'empty',
          text: '五度圏かダイアトニックの和音をクリックして進行を組み立てます。',
        }),
      );
      return;
    }

    const list = h('ol', { class: 'slots' });
    slotEls = state.prog.slots.map((slot, index) => {
      const card = buildSlot(slot, index);
      list.append(card);
      return card;
    });
    progHost.replaceChildren(meta, list);
    setCurrent(state.current);
  }

  function buildSlot(slot: Slot, index: number): HTMLLIElement {
    const roman = romanNumeralInKey(slot.rootPc, slot.qualityId, state.prog.keyPc, state.prog.mode);

    const qualitySelect = h('select', {
      class: 'field field-quality',
      attrs: { 'aria-label': 'コードの種類' },
      on: {
        change: (event) =>
          commit(
            updateSlotAt(state.prog, index, {
              qualityId: (event.target as HTMLSelectElement).value,
            }),
          ),
      },
    });
    for (const quality of QUALITIES) {
      const option = h('option', {
        text: `${quality.symbol || 'maj'} ・ ${quality.label}`,
        attrs: { value: quality.id },
      });
      if (quality.id === slot.qualityId) option.selected = true;
      qualitySelect.append(option);
    }

    const beatsLabel = h('span', { class: 'beats-value', text: String(slot.beats) });
    const stepper = h('div', { class: 'stepper', attrs: { 'aria-label': '拍数' } }, [
      iconButton('minus', '拍を減らす', () => changeBeats(index, -1)),
      beatsLabel,
      iconButton('plus', '拍を増やす', () => changeBeats(index, 1)),
    ]);

    const move = h('div', { class: 'slot-move' }, [
      iconButton(
        'left',
        '前へ移動',
        () => commit(moveSlot(state.prog, index, index - 1), false),
        index === 0,
      ),
      iconButton(
        'right',
        '次へ移動',
        () => commit(moveSlot(state.prog, index, index + 1), false),
        index === state.prog.slots.length - 1,
      ),
    ]);

    const el = h(
      'li',
      {
        class: 'slot',
        on: { click: () => player.preview(slot.rootPc, slot.qualityId) },
      },
      [
        h('div', { class: 'slot-head' }, [
          h('span', { class: 'slot-roman', text: roman }),
          h('span', { class: 'slot-symbol', text: symbolOf(slot) }),
        ]),
        h('div', { class: 'slot-controls', on: { click: (e) => e.stopPropagation() } }, [
          qualitySelect,
          h('div', { class: 'slot-row' }, [
            stepper,
            move,
            iconButton(
              'trash',
              '削除',
              () => commit(removeSlotAt(state.prog, index), false),
              false,
              'danger',
            ),
          ]),
        ]),
      ],
    ) as HTMLLIElement;
    el.style.setProperty('--i', String(index));
    return el;
  }

  function changeBeats(index: number, delta: number): void {
    const slot = state.prog.slots[index];
    if (!slot) return;
    const beats = Math.min(8, Math.max(1, slot.beats + delta));
    if (beats !== slot.beats) commit(updateSlotAt(state.prog, index, { beats }));
  }

  // ---- トランスポート ----

  const playBtn = h('button', { class: 'play', attrs: { type: 'button' } });
  const tempoRange = h('input', {
    class: 'tempo-range',
    attrs: { type: 'range', min: MIN_TEMPO, max: MAX_TEMPO, step: 1, 'aria-label': 'テンポ' },
  }) as HTMLInputElement;
  const tempoValue = h('span', { class: 'tempo-value' });
  const loopBtn = h('button', {
    class: 'toggle',
    attrs: { type: 'button' },
    html: `${icon('loop')}<span>ループ</span>`,
  });
  const presetSelect = h('select', {
    class: 'field',
    attrs: { 'aria-label': 'プリセット進行' },
  }) as HTMLSelectElement;
  const shareBtn = h('button', {
    class: 'ghost',
    attrs: { type: 'button' },
    html: `${icon('link')}<span>リンクをコピー</span>`,
  });
  const textBtn = h('button', {
    class: 'ghost',
    attrs: { type: 'button' },
    html: `${icon('copy')}<span>テキストでコピー</span>`,
  });
  const shareStatus = h('span', {
    class: 'share-status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  function buildTransport(): HTMLElement {
    playBtn.addEventListener('click', togglePlay);

    tempoRange.addEventListener('input', () => {
      tempoValue.textContent = `${tempoRange.value} BPM`;
    });
    tempoRange.addEventListener('change', () => {
      commit(setTempo(state.prog, Number(tempoRange.value)));
    });

    loopBtn.addEventListener('click', () => {
      state.loop = !state.loop;
      syncTransport();
    });

    const modeToggle = h(
      'div',
      { class: 'segmented', attrs: { role: 'group', 'aria-label': '発音の仕方' } },
      [playModeButton('和音', 'pad'), playModeButton('アルペジオ', 'arp')],
    );

    const transposeGroup = h(
      'div',
      { class: 'segmented', attrs: { role: 'group', 'aria-label': '移調' } },
      [
        iconButton('minus', '半音下げる', () => commit(transpose(state.prog, -1), false)),
        iconButton('plus', '半音上げる', () => commit(transpose(state.prog, 1), false)),
      ],
    );

    presetSelect.append(h('option', { text: 'プリセットを選ぶ…', attrs: { value: '' } }));
    for (const preset of PRESETS)
      presetSelect.append(h('option', { text: preset.name, attrs: { value: preset.id } }));
    presetSelect.addEventListener('change', () => {
      const preset = PRESETS.find((p) => p.id === presetSelect.value);
      if (preset) commit(preset.progression);
      presetSelect.value = '';
    });

    const randomBtn = h('button', {
      class: 'ghost',
      attrs: { type: 'button' },
      html: `${icon('shuffle')}<span>ランダム生成</span>`,
      on: { click: () => commit({ ...state.prog, slots: randomSlots() }) },
    });
    const clearBtn = h('button', {
      class: 'ghost',
      attrs: { type: 'button' },
      html: `${icon('trash')}<span>クリア</span>`,
      on: { click: () => commit({ ...state.prog, slots: [] }, false) },
    });

    shareBtn.addEventListener('click', copyLink);
    textBtn.addEventListener('click', copyText);

    return h('div', { class: 'transport' }, [
      h('div', { class: 'transport-main' }, [
        playBtn,
        h('div', { class: 'tempo' }, [labeled('テンポ', tempoRange), tempoValue]),
        loopBtn,
        labeled('発音', modeToggle),
      ]),
      h('div', { class: 'transport-side' }, [
        labeled('移調', transposeGroup),
        labeled('プリセット', presetSelect),
        randomBtn,
        clearBtn,
        h('div', { class: 'share' }, [shareBtn, textBtn, shareStatus]),
      ]),
    ]);
  }

  function playModeButton(label: string, mode: PlayMode): HTMLButtonElement {
    return h('button', {
      class: 'seg' + (state.playMode === mode ? ' is-active' : ''),
      text: label,
      attrs: { type: 'button', 'aria-pressed': state.playMode === mode },
      on: {
        click: () => {
          state.playMode = mode;
          player.mode = mode;
          syncTransport();
          if (state.playing) startPlayback();
        },
      },
    });
  }

  function randomSlots(): Slot[] {
    const chords = state.use7th
      ? diatonicSevenths(state.prog.keyPc, state.prog.mode)
      : diatonicTriads(state.prog.keyPc, state.prog.mode);
    const length = 4;
    const tonic = chords[0]!;
    const out: Slot[] = [{ rootPc: tonic.rootPc, qualityId: tonic.qualityId, beats: 4 }];
    for (let i = 1; i < length; i++) {
      const pick = chords[randInt(chords.length)]!;
      out.push({ rootPc: pick.rootPc, qualityId: pick.qualityId, beats: 4 });
    }
    return out;
  }

  async function copyToClipboard(text: string, done: string, fallback: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      shareStatus.textContent = done;
    } catch {
      shareStatus.textContent = fallback;
    }
    window.setTimeout(() => {
      shareStatus.textContent = '';
    }, 2600);
  }

  function copyLink(): void {
    const url = `${location.origin}${location.pathname}#p=${encodeProgression(state.prog)}`;
    void copyToClipboard(url, 'リンクをコピーしました', url);
  }

  function copyText(): void {
    void copyToClipboard(progressionText(state.prog), 'テキストをコピーしました', '');
  }

  function syncTransport(): void {
    playBtn.innerHTML = state.playing
      ? `${icon('stop')}<span>停止</span>`
      : `${icon('play')}<span>再生</span>`;
    playBtn.setAttribute('aria-pressed', String(state.playing));
    playBtn.classList.toggle('is-playing', state.playing);
    playBtn.disabled = !state.playing && state.prog.slots.length === 0;
    tempoRange.value = String(state.prog.tempo);
    tempoValue.textContent = `${state.prog.tempo} BPM`;
    loopBtn.setAttribute('aria-pressed', String(state.loop));
    loopBtn.classList.toggle('is-active', state.loop);
    for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>('.seg'))) {
      // 発音モードの押下状態を同期
      if (btn.textContent === '和音') setActive(btn, state.playMode === 'pad');
      if (btn.textContent === 'アルペジオ') setActive(btn, state.playMode === 'arp');
    }
  }

  function setActive(btn: HTMLButtonElement, active: boolean): void {
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }

  // ---- 共通の小物 ----

  // ボタン群も内包するため label 要素は使わない(クリックが先頭の操作子へ転送され
  // 暴発するのを避ける)。各操作子は自前の aria-label を持つ。
  function labeled(label: string, control: Node): HTMLDivElement {
    return h('div', { class: 'labeled' }, [
      h('span', { class: 'labeled-text', text: label }),
      control,
    ]);
  }

  function iconButton(
    name: Parameters<typeof icon>[0],
    label: string,
    onClick: () => void,
    disabled = false,
    variant = '',
  ): HTMLButtonElement {
    const btn = h('button', {
      class: 'icon-btn' + (variant ? ` ${variant}` : ''),
      html: icon(name),
      attrs: { type: 'button', 'aria-label': label, title: label },
      on: { click: onClick },
    });
    btn.disabled = disabled;
    return btn;
  }

  // ---- 組み立て ----

  const circleHost = h('div', { class: 'circle-host' });
  const keyHost = h('div', { class: 'key-host' });
  const progHost = h('div', { class: 'prog-host' });

  const header = h('header', { class: 'site-header' }, [
    h('div', { class: 'brand' }, [
      h('span', { class: 'brand-mark', html: brandMark() }),
      h('div', {}, [
        h('span', { class: 'brand-name', text: 'wasei' }),
        h('span', { class: 'brand-tag', text: 'コード進行プレイグラウンド' }),
      ]),
    ]),
  ]);

  const board = h('section', { class: 'board' }, [
    h('div', { class: 'panel panel-circle' }, [circleHost]),
    h('div', { class: 'panel panel-key' }, [h('h2', { text: 'キーとダイアトニック' }), keyHost]),
  ]);

  const progSection = h('section', { class: 'panel panel-prog' }, [
    h('h2', { text: '進行' }),
    progHost,
  ]);

  root.replaceChildren(
    header,
    h('main', { class: 'layout' }, [board, progSection, buildTransport()]),
  );

  renderCircle();
  renderKeyPanel();
  renderProgression();
  syncTransport();

  // キーボード: スペースで再生/停止(入力部品にフォーカスがある時は無効)
  window.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.code !== 'Space') return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (target?.getAttribute('role') === 'button') return;
    event.preventDefault();
    togglePlay();
  });

  window.addEventListener('hashchange', () => {
    const shared = decodeProgression(location.hash);
    if (shared) commit(shared, false);
  });
}

function initialProgression(): Progression {
  const fromHash = decodeProgression(location.hash);
  if (fromHash) return fromHash;
  const saved = loadString();
  if (saved) {
    const decoded = decodeProgression(saved);
    if (decoded) return decoded;
  }
  return defaultProgression();
}

function brandMark(): string {
  return (
    `<svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true">` +
    `<circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2" opacity="0.35" />` +
    `<circle cx="16" cy="16" r="6.5" stroke="currentColor" stroke-width="2" />` +
    `<path d="M16 3v6.5M16 22.5V29M3 16h6.5M22.5 16H29" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55" />` +
    `</svg>`
  );
}
