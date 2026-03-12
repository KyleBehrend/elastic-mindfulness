import * as Tone from "tone";
import type { ExperiencePhase } from "@/lib/experience-state";

// ── Pentatonic scale for strand plucks ───────────────────────────────
// D pentatonic across 2 octaves: D3 E3 G3 A3 B3 D4 E4 G4 A4 B4
const PENTATONIC_NOTES = [
  "D3", "E3", "G3", "A3", "B3",
  "D4", "E4", "G4", "A4", "B4",
];

/**
 * AudioEngine — singleton that manages all Tone.js audio for the experience.
 *
 * Must be initialised from a user gesture (Tone.start() requirement).
 * All methods are safe to call before init — they silently no-op.
 */
class AudioEngine {
  private initialized = false;
  private disposed = false;

  // ── Master output ────────────────────────────────────────────────
  private masterVolume: Tone.Volume | null = null;

  // ── Ambient drone ────────────────────────────────────────────────
  private droneSynth: Tone.PolySynth | null = null;
  private droneFilter: Tone.AutoFilter | null = null;
  private droneReverb: Tone.Reverb | null = null;

  // ── Breath sync ──────────────────────────────────────────────────
  private breathSynth: Tone.Synth | null = null;
  private breathChorus: Tone.Chorus | null = null;
  private breathReverb: Tone.Reverb | null = null;

  // ── Strand pluck ─────────────────────────────────────────────────
  private pluckSynth: Tone.PluckSynth | null = null;
  private pluckDelay: Tone.PingPongDelay | null = null;
  private pluckReverb: Tone.Reverb | null = null;

  // ── Dissolve ─────────────────────────────────────────────────────
  private noiseSynth: Tone.NoiseSynth | null = null;
  private noiseFilter: Tone.Filter | null = null;
  private reformSynth: Tone.Synth | null = null;
  private reformSequence: Tone.Sequence | null = null;

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Initialise the audio context and create all synths/effects.
   * MUST be called from a user gesture handler.
   */
  async init(): Promise<void> {
    if (this.initialized || this.disposed) return;

    await Tone.start();
    this.initialized = true;

    // Master volume
    this.masterVolume = new Tone.Volume(-6).toDestination();

    this.setupAmbientDrone();
    this.setupBreathSynth();
    this.setupPluckSynth();
    this.setupDissolveSynths();

    // Start the ambient drone
    this.startDrone();
  }

  /** Clean up all Tone nodes. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.reformSequence?.dispose();
    this.droneSynth?.releaseAll();

    const nodes = [
      this.droneSynth, this.droneFilter, this.droneReverb,
      this.breathSynth, this.breathChorus, this.breathReverb,
      this.pluckSynth, this.pluckDelay, this.pluckReverb,
      this.noiseSynth, this.noiseFilter, this.reformSynth,
      this.masterVolume,
    ];

    for (const node of nodes) {
      node?.dispose();
    }
  }

  /**
   * Adjust ambient drone character based on the current phase.
   * - breathe: darker, more filtered
   * - canvas: brighter, slightly more present
   * - dissolve: gradual brightening
   */
  setPhase(phase: ExperiencePhase): void {
    if (!this.initialized || !this.droneFilter) return;

    switch (phase) {
      case "breathe":
        this.droneFilter.baseFrequency = 200;
        this.droneSynth?.set({ volume: -22 });
        break;
      case "dissolve":
        this.droneFilter.baseFrequency = 400;
        this.droneSynth?.set({ volume: -20 });
        break;
      case "canvas":
        this.droneFilter.baseFrequency = 600;
        this.droneSynth?.set({ volume: -18 });
        break;
      default:
        this.droneFilter.baseFrequency = 300;
        this.droneSynth?.set({ volume: -20 });
        break;
    }
  }

  /** Trigger a soft rising tone for inhale (D3 → D4 over 4s). */
  triggerInhale(): void {
    if (!this.initialized || !this.breathSynth) return;

    const now = Tone.now();
    this.breathSynth.triggerAttack("D3", now);
    this.breathSynth.frequency.linearRampTo("D4", 4, now);
  }

  /** Trigger a soft falling tone for exhale (D4 → D3 with release). */
  triggerExhale(): void {
    if (!this.initialized || !this.breathSynth) return;

    const now = Tone.now();
    // Release the inhale tone
    this.breathSynth.triggerRelease(now);

    // Start the exhale as a new gentle attack
    this.breathSynth.triggerAttack("D4", now + 0.05);
    this.breathSynth.frequency.linearRampTo("D3", 4, now + 0.05);

    // Schedule release at the end
    this.breathSynth.triggerRelease(now + 3.8);
  }

  /**
   * Trigger a pluck sound when a strand is released.
   * @param length  Strand screen-length in world units — maps to pitch
   * @param speed   Normalised 0–1 — slow = rich, fast = thin
   */
  triggerPluck(length: number, speed: number): void {
    if (!this.initialized || !this.pluckSynth) return;

    // Map strand length to pentatonic note index
    // Short strands → high pitch (end of array), long strands → low pitch (start)
    const maxLength = 6; // rough max world-unit length on screen
    const normalizedLength = Math.max(0, Math.min(1, length / maxLength));
    const noteIndex = Math.floor((1 - normalizedLength) * (PENTATONIC_NOTES.length - 1));
    const note = PENTATONIC_NOTES[noteIndex];

    // Slow strands: longer resonance, more attack sustain
    // Fast strands: shorter, thinner
    const resonance = 0.8 + (1 - speed) * 0.15; // 0.8–0.95

    this.pluckSynth.set({
      attackNoise: 1 + speed * 3,
      resonance,
      release: 0.5 + (1 - speed) * 1.5,
    });

    // Adjust delay feedback: more reverb for slow strands
    if (this.pluckDelay) {
      this.pluckDelay.feedback.value = 0.1 + (1 - speed) * 0.2;
    }
    if (this.pluckReverb) {
      this.pluckReverb.wet.value = 0.2 + (1 - speed) * 0.4;
    }

    this.pluckSynth.triggerAttackRelease(note, 0.5 + (1 - speed) * 1.0);
  }

  /** Trigger the explosion burst at the start of the dissolve phase. */
  triggerDissolve(): void {
    if (!this.initialized || !this.noiseSynth || !this.noiseFilter) return;

    const now = Tone.now();

    // Bandpass filter sweep from 2000Hz → 200Hz over 2 seconds
    this.noiseFilter.frequency.setValueAtTime(2000, now);
    this.noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 2);

    this.noiseSynth.triggerAttackRelease("2n", now);
  }

  /** Trigger ascending arpeggiated tones as particles reform. */
  triggerReform(): void {
    if (!this.initialized || !this.reformSynth) return;

    // D pentatonic ascending arpeggio
    const notes = ["D3", "E3", "G3", "A3", "B3", "D4", "E4", "G4"];
    let delay = 0;

    for (const note of notes) {
      const time = Tone.now() + delay;
      this.reformSynth.triggerAttackRelease(note, "8n", time, 0.3);
      delay += 0.35; // stagger each note
    }
  }

  /** Set master volume in dB. */
  setVolume(db: number): void {
    if (!this.masterVolume) return;
    this.masterVolume.volume.value = db;
  }

  // ── Internal setup ───────────────────────────────────────────────

  private setupAmbientDrone(): void {
    if (!this.masterVolume) return;

    // Reverb for spaciousness
    this.droneReverb = new Tone.Reverb({
      decay: 4,
      wet: 0.6,
    }).connect(this.masterVolume);

    // Slow auto-filter LFO for evolution
    this.droneFilter = new Tone.AutoFilter({
      frequency: 0.05,
      baseFrequency: 300,
      octaves: 2.5,
    }).connect(this.droneReverb);
    this.droneFilter.start();

    // 3 slightly detuned oscillators via PolySynth
    this.droneSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 3,
        decay: 1,
        sustain: 1,
        release: 4,
      },
      volume: -20,
    }).connect(this.droneFilter);
    this.droneSynth.maxPolyphony = 3;
  }

  private startDrone(): void {
    if (!this.droneSynth) return;

    const now = Tone.now();
    // Three voices with slight detuning for warmth
    this.droneSynth.triggerAttack("D3", now);       // root
    this.droneSynth.set({ detune: 3 });
    this.droneSynth.triggerAttack("A3", now + 0.1);  // fifth
    this.droneSynth.set({ detune: -3 });
    this.droneSynth.triggerAttack("D4", now + 0.2);  // octave
    this.droneSynth.set({ detune: 0 });
  }

  private setupBreathSynth(): void {
    if (!this.masterVolume) return;

    this.breathReverb = new Tone.Reverb({
      decay: 3,
      wet: 0.5,
    }).connect(this.masterVolume);

    this.breathChorus = new Tone.Chorus({
      frequency: 0.5,
      depth: 0.3,
      delayTime: 3.5,
      wet: 0.4,
    }).connect(this.breathReverb);
    this.breathChorus.start();

    this.breathSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 2,
        decay: 0.5,
        sustain: 0.6,
        release: 2,
      },
      volume: -16,
    }).connect(this.breathChorus);
  }

  private setupPluckSynth(): void {
    if (!this.masterVolume) return;

    this.pluckReverb = new Tone.Reverb({
      decay: 2.5,
      wet: 0.35,
    }).connect(this.masterVolume);

    this.pluckDelay = new Tone.PingPongDelay({
      delayTime: "8n",
      feedback: 0.2,
      wet: 0.25,
    }).connect(this.pluckReverb);

    this.pluckSynth = new Tone.PluckSynth({
      attackNoise: 2,
      dampening: 4000,
      resonance: 0.9,
      release: 1,
      volume: -10,
    }).connect(this.pluckDelay);
  }

  private setupDissolveSynths(): void {
    if (!this.masterVolume) return;

    // Noise burst with bandpass filter
    this.noiseFilter = new Tone.Filter({
      type: "bandpass",
      frequency: 2000,
      Q: 2,
    }).connect(this.masterVolume);

    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: {
        attack: 0.05,
        decay: 1.5,
        sustain: 0,
        release: 0.5,
      },
      volume: -14,
    }).connect(this.noiseFilter);

    // Reform arpeggio synth
    this.reformSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.2,
        release: 0.8,
      },
      volume: -14,
    }).connect(new Tone.Reverb({ decay: 2, wet: 0.4 }).connect(this.masterVolume));
  }
}

// ── Singleton export ─────────────────────────────────────────────────
export const audioEngine = new AudioEngine();
