uniform float uTime;
uniform float uVibration;   // 0–1, decays after strand release
uniform float uThickness;   // tube radius scaling factor

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  vec3 pos = position;

  // ── 1. Ambient wave — gentle undulation along the strand ─────────
  float wave = sin(pos.x * 4.0 + uTime) * 0.02 * (1.0 + uVibration * 3.0);
  pos += normal * wave;

  // ── 2. Secondary harmonic for organic richness ───────────────────
  float wave2 = sin(pos.x * 9.0 - uTime * 1.4) * 0.008 * (1.0 + uVibration * 2.0);
  pos += normal * wave2;

  // ── 3. Pluck vibration — high-frequency displacement on release ──
  //    Scales with uVibration which decays from 1→0 over ~2 seconds
  if (uVibration > 0.01) {
    // Fast oscillation perpendicular to strand
    float pluck = sin(pos.x * 16.0 + uTime * 12.0) * uVibration * 0.04;
    pos += normal * pluck;

    // Cross-axis wobble for richer vibration feel
    float crossWobble = cos(pos.x * 11.0 - uTime * 8.0) * uVibration * 0.02;
    pos.z += crossWobble;
  }

  // ── 4. Subtle Z breathing for depth ──────────────────────────────
  pos.z += cos(pos.x * 2.5 + uTime * 0.35) * 0.01;

  vPosition = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
