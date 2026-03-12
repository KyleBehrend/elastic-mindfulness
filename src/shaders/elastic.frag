#include <noise>

uniform float uStretch;
uniform float uTime;
uniform vec3 uBaseColor;   // warm gold  #D4A574
uniform vec3 uGlowColor;   // light gold #E8C9A0

varying vec2 vUv;
varying vec3 vNormal;
varying float vStretch;

void main() {
  // ── 1. Base colour — shifts toward glow as the band stretches ──────
  vec3 color = mix(uBaseColor, uGlowColor, vStretch * 0.7);

  // ── 2. Fresnel / edge glow — bioluminescent rim ────────────────────
  float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
  float fresnel = pow(rim, 2.5);
  color += uGlowColor * fresnel * (0.4 + vStretch * 0.4);

  // ── 3. Noise variation — subtle organic texture ────────────────────
  float n = snoise(vUv * 2.0 + uTime * 0.05);
  color += n * 0.05;

  // ── 4. Breathing pulse — gentle overall brightness oscillation ─────
  float pulse = sin(uTime * 0.3) * 0.03;
  color += pulse;

  // Clamp to avoid negative values from noise/pulse
  color = max(color, 0.0);

  // ── 5. Alpha — 0.85 base with fresnel boost to 1.0 at edges ───────
  float alpha = 0.85 + fresnel * 0.15;

  // ── 6. Premultiplied alpha output ──────────────────────────────────
  gl_FragColor = vec4(color * alpha, alpha);
}
