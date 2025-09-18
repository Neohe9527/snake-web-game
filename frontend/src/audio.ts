interface SoundOptions {
  frequency: number;
  type: OscillatorType;
  duration: number;
  volume: number;
}

export class AudioManager {
  private context?: AudioContext;
  private enabled: boolean;
  private hasUnlocked = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', () => this.unlock(), { once: true });
      window.addEventListener('keydown', () => this.unlock(), { once: true });
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private unlock() {
    if (this.hasUnlocked || typeof window === 'undefined') return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    this.context = new Ctx();
    if (this.context.state === 'suspended') {
      this.context.resume().catch((err) => console.warn('Audio resume failed', err));
    }
    this.hasUnlocked = true;
  }

  playEat() {
    this.play({ frequency: 440, type: 'square', duration: 0.12, volume: 0.2 });
  }

  playCrash() {
    this.play({ frequency: 110, type: 'sawtooth', duration: 0.3, volume: 0.3 });
  }

  private play(options: SoundOptions) {
    if (!this.enabled || !this.context) return;

    const { frequency, type, duration, volume } = options;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;

    osc.connect(gain).connect(this.context.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    osc.stop(this.context.currentTime + duration + 0.05);
  }
}
