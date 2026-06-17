class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Lazy initialize when user interacts
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleSound(enabled?: boolean) {
    if (enabled !== undefined) {
      this.soundEnabled = enabled;
    } else {
      this.soundEnabled = !this.soundEnabled;
    }
    return this.soundEnabled;
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  public playJump() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square"; // 8-bit square wave
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  public playCrouch() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle"; // softer triangle wave
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  public playPoint() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6 note

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  public playGameOver() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      const t = ctx.currentTime;

      // Make a sad arpeggio
      const notes = [293.66, 277.18, 261.63, 220.00]; // D4, C#4, C4, A3
      const durations = [0.15, 0.15, 0.15, 0.4];

      let elapsed = 0;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth"; // retro crunch
        osc.frequency.setValueAtTime(freq, t + elapsed);
        
        gain.gain.setValueAtTime(0.06, t + elapsed);
        gain.gain.exponentialRampToValueAtTime(0.001, t + elapsed + durations[idx]);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + elapsed);
        osc.stop(t + elapsed + durations[idx]);

        elapsed += durations[idx] * 0.8;
      });
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }
}

export const soundEngine = new RetroAudioEngine();
