// Web Audioによる発音。コードを和音(パッド)かアルペジオで鳴らし、進行をテンポに
// 沿って正確な時刻へ予約する。発音の規則(構成音・ボイシング・刻み)は純粋関数に
// 任せ、ここはAudioContextへの橋渡しと後始末に徹する。

import { buildArpeggio } from './arp';
import { loopDuration, type Progression, scheduleSlots } from './progression';
import { midiToFreq } from './notes';
import { voiceChord, voiceLead } from './voicing';

export type PlayMode = 'pad' | 'arp';

interface Envelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

const PAD: Envelope = { attack: 0.015, decay: 0.25, sustain: 0.72, release: 0.35 };
const ARP: Envelope = { attack: 0.006, decay: 0.12, sustain: 0.5, release: 0.16 };
const PLUCK: Envelope = { attack: 0.005, decay: 0.18, sustain: 0.32, release: 0.45 };

const LOOKAHEAD = 0.08;

type WindowWithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export interface PlayOptions {
  readonly loop: boolean;
  onStep?(index: number): void;
  onEnd?(): void;
}

export class Player {
  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private timers: number[] = [];
  private volume = 0.85;

  mode: PlayMode = 'pad';
  playing = false;

  /** このブラウザでWeb Audioが使えるか */
  static get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext);
  }

  /** AudioContextを起こす。利用者の操作の中で一度呼ぶ必要がある */
  async resume(): Promise<void> {
    const ctx = this.tryEnsure();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  /** クリック時などに1コードを即時プレビューする */
  preview(rootPc: number, qualityId: string): void {
    const ctx = this.tryEnsure();
    if (!ctx) return;
    void ctx.resume();
    const notes = voiceChord(rootPc, qualityId, { octave: 4, bass: true });
    const peak = 0.7 / Math.sqrt(notes.length);
    const start = ctx.currentTime + 0.01;
    for (const midi of notes) this.voice(midi, start, 1.1, PLUCK, peak);
  }

  /** 進行を再生する。既存の再生は止めてから始める */
  play(prog: Progression, options: PlayOptions): void {
    const ctx = this.tryEnsure();
    if (!ctx) return;
    void ctx.resume();
    this.stop();
    this.playing = true;
    this.scheduleIteration(prog, ctx.currentTime + LOOKAHEAD, options);
  }

  stop(): void {
    this.playing = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      const old = this.master;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.06);
      window.setTimeout(() => old.disconnect(), 220);
      this.master = null; // 次回の再生で作り直す
    }
  }

  private scheduleIteration(prog: Progression, startTime: number, options: PlayOptions): void {
    const scheduled = scheduleSlots(prog.slots, prog.tempo, startTime);
    const secondsPerBeat = 60 / prog.tempo;
    let prev: number[] | null = null;

    for (const item of scheduled) {
      const notes = voiceLead(prev, item.slot.rootPc, item.slot.qualityId, { octave: 4, bass: true });
      prev = notes;
      if (this.mode === 'arp') {
        const peak = 0.62;
        for (const event of buildArpeggio(notes, item.duration, secondsPerBeat / 2)) {
          this.voice(event.midi, item.start + event.start, event.duration, ARP, peak);
        }
      } else {
        const peak = 0.7 / Math.sqrt(notes.length);
        for (const midi of notes) this.voice(midi, item.start, item.duration, PAD, peak);
      }
      this.at(item.start, () => options.onStep?.(item.index));
    }

    const endAt = startTime + loopDuration(prog);
    if (options.loop) {
      // 次の周回を切れ目なくつなぐため、終端の少し手前で先回りして予約する。
      this.at(endAt - 0.05, () => {
        if (this.playing) this.scheduleIteration(prog, endAt, options);
      });
    } else {
      this.at(endAt, () => {
        if (!this.playing) return;
        this.stop();
        options.onEnd?.();
      });
    }
  }

  // 指定の発音時刻に合わせてUIコールバックを鳴らす。
  private at(when: number, fn: () => void): void {
    const ctx = this.ensure();
    const delay = Math.max(0, (when - ctx.currentTime) * 1000);
    this.timers.push(window.setTimeout(fn, delay));
  }

  private voice(midi: number, start: number, duration: number, env: Envelope, peak: number): void {
    const ctx = this.ensure();
    const master = this.master!;
    const freq = midiToFreq(midi);

    const gain = ctx.createGain();
    const sustainLevel = peak * env.sustain;
    const decayEnd = start + env.attack + env.decay;
    const releaseStart = Math.max(decayEnd, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + env.attack);
    gain.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
    gain.gain.setValueAtTime(sustainLevel, releaseStart);
    gain.gain.linearRampToValueAtTime(0.0001, releaseStart + env.release);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'triangle';
    fundamental.frequency.setValueAtTime(freq, start);

    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(freq * 2, start);
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.26;

    fundamental.connect(gain);
    shimmer.connect(shimmerGain).connect(gain);
    gain.connect(master);

    const stopAt = releaseStart + env.release + 0.02;
    fundamental.start(start);
    shimmer.start(start);
    fundamental.stop(stopAt);
    shimmer.stop(stopAt);
    fundamental.onended = () => {
      gain.disconnect();
      shimmerGain.disconnect();
    };
  }

  // 文脈を確保できなければ null。発音できない環境でもUIを壊さないための入口。
  private tryEnsure(): AudioContext | null {
    try {
      return this.ensure();
    } catch {
      return null;
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctor) throw new Error('このブラウザはWeb Audioに対応していない');
      this.ctx = new Ctor();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 7800;
      filter.Q.value = 0.4;
      filter.connect(this.ctx.destination);
      this.filter = filter;
    }
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.filter!);
    }
    return this.ctx;
  }
}
