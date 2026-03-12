uniform float uStretch;   // 0–1 breath stretch amount
uniform float uTime;
uniform float uWobble;    // amplitude of organic movement

varying vec2 vUv;
varying vec3 vNormal;
varying float vStretch;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vStretch = uStretch;

  vec3 pos = position;

  // 1. Stretching elongates the band along X
  pos.x *= 1.0 + uStretch * 2.0;

  // 2. Stretching makes the band thinner (Y and Z)
  float thinning = 1.0 - uStretch * 0.3;
  pos.y *= thinning;
  pos.z *= thinning;

  // 3. Organic wobble — attenuates as the band stretches taut
  float wobbleScale = 1.0 - uStretch * 0.5;
  pos.y += sin(pos.x * 3.0 + uTime * 0.5) * uWobble * wobbleScale;

  // Secondary wobble harmonic for richer movement
  pos.y += sin(pos.x * 7.0 - uTime * 0.8) * uWobble * wobbleScale * 0.25;

  // Subtle Z sway for depth
  pos.z += cos(pos.x * 2.5 + uTime * 0.35) * uWobble * wobbleScale * 0.3;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
