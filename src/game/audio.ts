import { SimAudioEvent } from './types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.08,
    endFreq?: number,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playEvent(event: SimAudioEvent | null): void {
    if (!event || this.muted) return;
    const jitter = 0.94 + Math.random() * 0.12;

    switch (event) {
      case 'work_tick':
        this.playTone(420 * jitter, 0.04, 'triangle', 0.03, 280);
        break;
      case 'slack_phone':
        this.playTone(660, 0.07, 'sine', 0.06, 880);
        this.playTone(990, 0.09, 'sine', 0.05, 1120, 0.06);
        break;
      case 'slack_game':
        this.playTone(523, 0.06, 'square', 0.035);
        this.playTone(659, 0.06, 'square', 0.035, undefined, 0.06);
        this.playTone(784, 0.09, 'square', 0.035, undefined, 0.12);
        break;
      case 'slack_snack':
        this.playTone(260 * jitter, 0.06, 'sawtooth', 0.04, 150);
        this.playTone(320 * jitter, 0.06, 'sawtooth', 0.04, 170, 0.07);
        break;
      case 'slack_nap':
        this.playTone(290, 0.22, 'sine', 0.05, 220);
        break;
      case 'coffee':
        this.playTone(440, 0.09, 'triangle', 0.07, 660);
        this.playTone(660, 0.14, 'triangle', 0.07, 880, 0.08);
        break;
      case 'prank':
        this.playTone(300, 0.1, 'sawtooth', 0.05, 180);
        this.playTone(580, 0.12, 'triangle', 0.06, 820, 0.09);
        break;
      case 'spotted':
        this.playTone(540, 0.1, 'sawtooth', 0.07, 720);
        break;
      case 'close_call':
        this.playTone(587, 0.08, 'triangle', 0.08);
        this.playTone(880, 0.16, 'triangle', 0.08, undefined, 0.07);
        break;
      case 'strike':
        this.playTone(220, 0.25, 'sawtooth', 0.1, 110);
        this.playTone(165, 0.3, 'square', 0.06, 95, 0.08);
        break;
      case 'task_done':
        this.playTone(523, 0.09, 'triangle', 0.08);
        this.playTone(659, 0.09, 'triangle', 0.08, undefined, 0.08);
        this.playTone(784, 0.18, 'triangle', 0.08, undefined, 0.16);
        break;
      case 'boss_warning':
        this.playTone(440, 0.14, 'square', 0.05);
        this.playTone(440, 0.14, 'square', 0.05, undefined, 0.22);
        break;
      case 'level_clear':
        this.playTone(523, 0.1, 'triangle', 0.09);
        this.playTone(659, 0.1, 'triangle', 0.09, undefined, 0.1);
        this.playTone(784, 0.1, 'triangle', 0.09, undefined, 0.2);
        this.playTone(1046, 0.3, 'triangle', 0.1, undefined, 0.3);
        break;
      case 'defeat':
        this.playTone(330, 0.18, 'sawtooth', 0.08, 260);
        this.playTone(260, 0.22, 'sawtooth', 0.08, 180, 0.18);
        this.playTone(180, 0.35, 'sawtooth', 0.08, 110, 0.38);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
