#include <noise>

uniform float uTime;
uniform float uGlow;       // 0–1, slow-drawn = high glow, fast = low
uniform vec3  uColor;      // per-strand base colour
uniform float uOpacity;    // overall opacity (for fade in/out)

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// ── Pseudo-random hash for sparkle ─────────────────────────────────
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // ── 1. Edge distance — vUv.y spans 0→1 around the tube cross-section
  //    Map to radial distance from centre: 0 at core, 1 at edge
  float edgeDist = abs(vUv.y - 0.5) * 2.0;

  // ── 2. Core colour — centre is full colour, edges fade to black ──
  vec3 coreColor = uColor;

  // ── 3. Edge glow — additive emission weighted toward edges ───────
  //    Smooth falloff: bright core → glowing edge halo
  float edgeGlow = smoothstep(0.3, 0.95, edgeDist);
  float coreWeight = 1.0 - smoothstep(0.0, 0.7, edgeDist);

  // Glow colour: brighter, warmer version of the base
  vec3 glowColor = uColor * 1.4 + vec3(0.15, 0.1, 0.05);

  // Combine: core at centre, glow emission at edges
  vec3 color = coreColor * coreWeight + glowColor * edgeGlow * uGlow;

  // ── 4. Fresnel rim — bioluminescent edge highlight ───────────────
  float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
  float fresnel = pow(rim, 2.0);
  color += glowColor * fresnel * (0.3 + uGlow * 0.5);

  // ── 5. Sparkle — scattered bright pixels along high-glow strands ─
  //    Grid-based: tile the strand surface, hash each cell
  float sparkleFreq = 40.0 + uGlow * 60.0;  // more sparkles on glowy strands
  vec2 sparkleCell = floor(vec2(vUv.x * sparkleFreq, vUv.y * 8.0));
  float sparkleRand = hash(sparkleCell);

  // Only a few cells sparkle — threshold controls density
  float sparkleDensity = 0.92 - uGlow * 0.06;  // ~8% base, up to ~14% for glow
  if (sparkleRand > sparkleDensity) {
    // Flash timing: each sparkle has its own phase
    float sparklePhase = sparkleRand * 100.0;
    float sparkleFlash = pow(max(0.0, sin(uTime * 3.0 + sparklePhase)), 12.0);
    color += vec3(1.0, 0.95, 0.85) * sparkleFlash * 0.4 * uGlow;
  }

  // ── 6. Time-based shimmer — subtle brightness oscillation ────────
  //    Different rate per strand (driven by colour hash for variation)
  float shimmerRate = 0.4 + hash(uColor.xy) * 0.6;
  float shimmer = sin(uTime * shimmerRate + vUv.x * 3.0) * 0.025;
  color += shimmer * uGlow;

  // ── 7. Noise texture — organic surface variation ─────────────────
  float n = snoise(vUv * 3.0 + uTime * 0.04);
  color += n * 0.03;

  // Clamp to avoid negative values
  color = max(color, 0.0);

  // ── 8. Alpha — tube fades at edges, with glow boost ──────────────
  float edgeAlpha = 1.0 - smoothstep(0.7, 1.0, edgeDist);
  float glowAlpha = edgeGlow * uGlow * 0.3;  // glow adds some alpha at edges
  float alpha = (edgeAlpha + glowAlpha) * uOpacity;

  // Premultiplied alpha output
  gl_FragColor = vec4(color * alpha, alpha);
}
