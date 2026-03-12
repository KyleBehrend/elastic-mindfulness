import * as THREE from "three";

// ── Slow palette (rewarded — warm, luminous) ─────────────────────────
const SLOW_COLORS = [
  new THREE.Color(0xd4a574), // warm gold
  new THREE.Color(0xc4727f), // rose
  new THREE.Color(0xb8864e), // amber
  new THREE.Color(0xf5f0eb), // cream
  new THREE.Color(0xa65d57), // deep coral
];

// ── Fast palette (muted — cool, understated) ─────────────────────────
const FAST_COLORS = [
  new THREE.Color(0x4a4a52), // slate
  new THREE.Color(0x8a7a5a), // dim gold
  new THREE.Color(0x6b6b78), // cool grey
  new THREE.Color(0x5a6a7a), // faded blue
];

/**
 * Pick a strand colour based on normalised speed (0 = slow, 1 = fast).
 *
 * At speed 0, picks randomly from the warm slow palette.
 * At speed 1, picks randomly from the muted fast palette.
 * In between, selects a random entry from each palette and blends
 * between them — so intermediate speeds get a mix of warmth and muting.
 */
export function getStrandColor(speed: number): THREE.Color {
  const s = Math.max(0, Math.min(1, speed));

  const slowIdx = Math.floor(Math.random() * SLOW_COLORS.length);
  const fastIdx = Math.floor(Math.random() * FAST_COLORS.length);

  const slow = SLOW_COLORS[slowIdx].clone();
  const fast = FAST_COLORS[fastIdx].clone();

  return slow.lerp(fast, s);
}

/**
 * Derive a glow colour from a base colour — brighter and slightly
 * warmer, used for edge emission and bloom.
 */
export function getGlowColor(base: THREE.Color): THREE.Color {
  return base.clone().lerp(new THREE.Color(1.0, 0.95, 0.88), 0.4);
}

/**
 * Compute glow intensity from speed.
 * Slow strands (speed → 0) get full glow (1.0).
 * Fast strands (speed → 1) get minimal glow (0.1).
 */
export function getGlowIntensity(speed: number): number {
  const s = Math.max(0, Math.min(1, speed));
  return 1.0 - s * 0.9;
}
