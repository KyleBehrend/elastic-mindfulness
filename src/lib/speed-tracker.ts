/**
 * SpeedTracker — the core mechanic of Elastic Mindfulness.
 *
 * Tracks pointer/touch velocity over a rolling 500ms window and
 * normalises it to a 0–1 range where:
 *   0 = perfectly still  →  maximum beauty
 *   1 = frantic movement →  visual chaos / nothing
 *
 * Slow  = < 50 px/sec
 * Fast  = > 500 px/sec
 */

interface PositionSample {
  x: number;
  y: number;
  t: number; // timestamp in ms
}

const WINDOW_MS = 500;
const SLOW_THRESHOLD = 50; // px/sec
const FAST_THRESHOLD = 500; // px/sec
const SMOOTHING_FACTOR = 0.15; // exponential smoothing alpha

export class SpeedTracker {
  private samples: PositionSample[] = [];
  private smoothedSpeed = 0;

  // Cumulative tracking for full-gesture average
  private totalDistance = 0;
  private gestureStart = 0;
  private lastPoint: { x: number; y: number } | null = null;

  /** Record a position sample. */
  addPoint(x: number, y: number, timestamp: number): void {
    // Accumulate total distance for getAverageSpeed
    if (this.lastPoint) {
      const dx = x - this.lastPoint.x;
      const dy = y - this.lastPoint.y;
      this.totalDistance += Math.sqrt(dx * dx + dy * dy);
    } else {
      this.gestureStart = timestamp;
    }
    this.lastPoint = { x, y };

    this.samples.push({ x, y, t: timestamp });
    this.pruneOldSamples(timestamp);
    this.smoothedSpeed =
      SMOOTHING_FACTOR * this.getRawSpeed() +
      (1 - SMOOTHING_FACTOR) * this.smoothedSpeed;
  }

  /** Normalised speed 0–1 from the rolling window. */
  getSpeed(): number {
    return this.normalise(this.getRawSpeed());
  }

  /** Exponentially smoothed speed 0–1 (less jittery). */
  getSmoothedSpeed(): number {
    return this.normalise(this.smoothedSpeed);
  }

  /**
   * Average speed over the entire drag gesture (not just the rolling window).
   * Returns normalised 0–1. Use this on release to determine the final
   * strand colour and glow intensity.
   */
  getAverageSpeed(): number {
    if (!this.lastPoint || this.samples.length < 2) return 0;
    const last = this.samples[this.samples.length - 1];
    const elapsed = (last.t - this.gestureStart) / 1000; // seconds
    if (elapsed <= 0) return 0;
    return this.normalise(this.totalDistance / elapsed);
  }

  /** Reset all tracked state. */
  reset(): void {
    this.samples = [];
    this.smoothedSpeed = 0;
    this.totalDistance = 0;
    this.gestureStart = 0;
    this.lastPoint = null;
  }

  // ── Internal helpers ───────────────────────────────────────────────

  /** Average velocity in px/sec across the sample window. */
  private getRawSpeed(): number {
    if (this.samples.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1];
      const curr = this.samples[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = (last.t - first.t) / 1000; // seconds

    if (elapsed <= 0) return 0;
    return totalDistance / elapsed;
  }

  /** Map px/sec to 0–1 using the slow/fast thresholds. */
  private normalise(pxPerSec: number): number {
    if (pxPerSec <= SLOW_THRESHOLD) return 0;
    if (pxPerSec >= FAST_THRESHOLD) return 1;
    return (pxPerSec - SLOW_THRESHOLD) / (FAST_THRESHOLD - SLOW_THRESHOLD);
  }

  /** Remove samples older than the rolling window. */
  private pruneOldSamples(now: number): void {
    const cutoff = now - WINDOW_MS;
    let i = 0;
    while (i < this.samples.length && this.samples[i].t < cutoff) {
      i++;
    }
    if (i > 0) {
      this.samples = this.samples.slice(i);
    }
  }
}
