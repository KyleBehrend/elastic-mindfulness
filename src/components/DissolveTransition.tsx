"use client";

import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { motion } from "motion/react";
import { useExperience } from "@/lib/experience-state";
import { audioEngine } from "@/lib/audio-engine";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import * as THREE from "three";

// ── Timing ───────────────────────────────────────────────────────────
const PHASE_1_END = 2.0; // explosion
const PHASE_2_END = 5.0; // swirl
const PHASE_3_END = 8.0; // reformation
const HOLD_DURATION = 9.5; // show text after this
const CTA_DELAY = 10.0;
const MAX_PARTICLES = 500;

// ── Palette ──────────────────────────────────────────────────────────
const GOLD: [number, number, number] = [0.831, 0.647, 0.455]; // #D4A574
const ROSE: [number, number, number] = [0.769, 0.447, 0.498]; // #C4727F
const AMBER: [number, number, number] = [0.722, 0.525, 0.306]; // #B8864E
const CREAM: [number, number, number] = [0.961, 0.941, 0.922]; // #F5F0EB
const TARGET_PALETTE = [GOLD, ROSE, AMBER, CREAM];

// ── Inline shaders ───────────────────────────────────────────────────
const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    // Soft glow falloff — brighter core, gentle edge
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── CPU noise for swirl displacement ─────────────────────────────────
function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

// ── Mandala target generation ────────────────────────────────────────
function generateMandalaTargets(count: number): Float32Array {
  const targets = new Float32Array(count * 3);
  const RINGS = 5;
  const SYMMETRY = 6;
  const ringRadii = [0.3, 0.7, 1.2, 1.8, 2.4];
  const totalWeight = ringRadii.reduce((a, r) => a + r, 0);

  // Distribute particles proportionally to ring radius
  const ringSizes: number[] = [];
  let remaining = count;
  for (let i = 0; i < RINGS; i++) {
    if (i === RINGS - 1) {
      ringSizes.push(remaining);
    } else {
      const n = Math.round((count * ringRadii[i]) / totalWeight);
      ringSizes.push(n);
      remaining -= n;
    }
  }

  let idx = 0;
  for (let ring = 0; ring < RINGS; ring++) {
    const ringCount = ringSizes[ring];
    const radius = ringRadii[ring];
    const perPetal = Math.floor(ringCount / SYMMETRY);
    const extra = ringCount % SYMMETRY;

    for (let petal = 0; petal < SYMMETRY; petal++) {
      const petalCount = perPetal + (petal < extra ? 1 : 0);
      const petalBase = (petal / SYMMETRY) * Math.PI * 2;

      for (let j = 0; j < petalCount; j++) {
        if (idx >= count) break;
        // Spread particles within the petal's angular slice
        const spread = ((j / petalCount) - 0.5) * (Math.PI * 2 / SYMMETRY) * 0.65;
        const angle = petalBase + spread + (Math.random() - 0.5) * 0.08;
        const r = radius + (Math.random() - 0.5) * 0.15;

        targets[idx * 3] = Math.cos(angle) * r;
        targets[idx * 3 + 1] = Math.sin(angle) * r;
        targets[idx * 3 + 2] = (Math.random() - 0.5) * 0.05;
        idx++;
      }
    }
  }

  return targets;
}

// ── Particle data initialisation ─────────────────────────────────────
function initParticleData(count: number) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const baseSizes = new Float32Array(count);
  const targetColors = new Float32Array(count * 3);
  const targets = generateMandalaTargets(count);

  for (let i = 0; i < count; i++) {
    const idx = i * 3;

    // Sample initial position along the elastic band tube
    const t = i / count;
    const bandX = -1.5 + t * 3.0;
    const tubeAngle = Math.random() * Math.PI * 2;
    const tubeR = 0.12;

    positions[idx] = bandX;
    positions[idx + 1] = Math.cos(tubeAngle) * tubeR;
    positions[idx + 2] = Math.sin(tubeAngle) * tubeR;

    // Explosion velocity: radial outward from tube surface + upward bias
    const speed = 0.5 + Math.random() * 1.5;
    velocities[idx] = (Math.random() - 0.5) * speed * 0.6;
    velocities[idx + 1] = Math.cos(tubeAngle) * speed * 0.5 + 0.1 + Math.random() * 0.25;
    velocities[idx + 2] = Math.sin(tubeAngle) * speed * 0.4;

    // Start as warm gold
    colors[idx] = GOLD[0];
    colors[idx + 1] = GOLD[1];
    colors[idx + 2] = GOLD[2];

    // Pick a random target colour from the palette
    const tc = TARGET_PALETTE[Math.floor(Math.random() * TARGET_PALETTE.length)];
    targetColors[idx] = tc[0];
    targetColors[idx + 1] = tc[1];
    targetColors[idx + 2] = tc[2];

    // Random point size 1–4px
    const s = 1.0 + Math.random() * 3.0;
    sizes[i] = s;
    baseSizes[i] = s;
  }

  return { positions, velocities, colors, sizes, baseSizes, targetColors, targets };
}

// ── DissolveParticles (R3F) ──────────────────────────────────────────
function DissolveParticles({
  activeCountRef,
  exitingRef,
  audioEnabledRef,
}: {
  activeCountRef: React.MutableRefObject<number>;
  exitingRef: React.MutableRefObject<boolean>;
  audioEnabledRef: React.MutableRefObject<boolean>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const startRef = useRef(0);
  const dissolveTriggeredRef = useRef(false);
  const reformTriggeredRef = useRef(false);

  const data = useMemo(() => initParticleData(MAX_PARTICLES), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Dispose shader material on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    if (startRef.current === 0) startRef.current = state.clock.getElapsedTime();
    const elapsed = state.clock.getElapsedTime() - startRef.current;

    // Audio triggers (one-shot)
    if (audioEnabledRef.current) {
      if (!dissolveTriggeredRef.current && elapsed > 0.01) {
        dissolveTriggeredRef.current = true;
        audioEngine.triggerDissolve();
      }
      if (!reformTriggeredRef.current && elapsed >= PHASE_2_END) {
        reformTriggeredRef.current = true;
        audioEngine.triggerReform();
      }
    }

    const geom = pointsRef.current.geometry;
    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const colAttr = geom.attributes.aColor as THREE.BufferAttribute;
    const sizeAttr = geom.attributes.aSize as THREE.BufferAttribute;

    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;
    const siz = sizeAttr.array as Float32Array;

    const { velocities, targets, targetColors, baseSizes } = data;
    const count = activeCountRef.current;

    // ── Exit scatter ─────────────────────────────────────────────
    if (exitingRef.current) {
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const x = pos[idx],
          y = pos[idx + 1],
          z = pos[idx + 2];
        const dist = Math.sqrt(x * x + y * y + z * z) + 0.01;
        pos[idx] += (x / dist) * 0.1;
        pos[idx + 1] += (y / dist) * 0.1;
        pos[idx + 2] += (z / dist) * 0.05;
        siz[i] *= 0.96;
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      geom.setDrawRange(0, count);
      return;
    }

    // ── Main animation loop ──────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let x = pos[idx],
        y = pos[idx + 1],
        z = pos[idx + 2];
      let vx = velocities[idx],
        vy = velocities[idx + 1],
        vz = velocities[idx + 2];

      if (elapsed < PHASE_1_END) {
        // ── Phase 1: Explosion ─────────────────────────────────
        vy -= 0.01; // light gravity
        vx *= 0.98; // drag
        vy *= 0.98;
        vz *= 0.98;

        x += vx * 0.016;
        y += vy * 0.016;
        z += vz * 0.016;
      } else if (elapsed < PHASE_2_END) {
        // ── Phase 2: Vortex swirl ──────────────────────────────
        const swirlT =
          (elapsed - PHASE_1_END) / (PHASE_2_END - PHASE_1_END);
        const dist = Math.sqrt(x * x + y * y) + 0.001;

        // Angular velocity (tangential)
        const angSpeed = 0.02 + swirlT * 0.04;
        const ax = (-y / dist) * angSpeed;
        const ay = (x / dist) * angSpeed;

        // Inward radial pull (strengthens over time)
        const pull = 0.003 + swirlT * 0.006;
        const rx = (-x / dist) * pull;
        const ry = (-y / dist) * pull;

        // Noise displacement prevents uniform clustering
        const nx =
          noise2D(x * 1.5 + elapsed * 0.3, y * 1.5) * 0.005;
        const ny =
          noise2D(y * 1.5, x * 1.5 + elapsed * 0.3) * 0.005;

        vx = vx * 0.88 + ax + rx + nx;
        vy = vy * 0.88 + ay + ry + ny;
        vz *= 0.93;

        x += vx;
        y += vy;
        z += vz;

        // Shift colours toward target palette
        const colorLerp = swirlT * 0.05;
        col[idx] += (targetColors[idx] - col[idx]) * colorLerp;
        col[idx + 1] +=
          (targetColors[idx + 1] - col[idx + 1]) * colorLerp;
        col[idx + 2] +=
          (targetColors[idx + 2] - col[idx + 2]) * colorLerp;
      } else if (elapsed < PHASE_3_END) {
        // ── Phase 3: Mandala reformation ───────────────────────
        const reformT =
          (elapsed - PHASE_2_END) / (PHASE_3_END - PHASE_2_END);
        // Smoothstep ease
        const ease = reformT * reformT * (3 - 2 * reformT);

        const tx = targets[idx],
          ty = targets[idx + 1],
          tz = targets[idx + 2];

        // LERP toward target position
        const lerpSpeed = 0.03 + ease * 0.04;
        x += (tx - x) * lerpSpeed;
        y += (ty - y) * lerpSpeed;
        z += (tz - z) * lerpSpeed;

        // Proximity glow flash
        const tDist = Math.sqrt(
          (x - tx) ** 2 + (y - ty) ** 2 + (z - tz) ** 2
        );
        if (tDist < 0.06 && reformT > 0.25) {
          const pulse =
            1 + Math.sin(elapsed * 8 + i * 0.7) * 0.3 * (1 - reformT);
          siz[i] = baseSizes[i] * pulse * 1.3;
        } else {
          siz[i] = baseSizes[i];
        }

        // Final colour convergence
        col[idx] += (targetColors[idx] - col[idx]) * 0.04;
        col[idx + 1] +=
          (targetColors[idx + 1] - col[idx + 1]) * 0.04;
        col[idx + 2] +=
          (targetColors[idx + 2] - col[idx + 2]) * 0.04;

        vx = vy = vz = 0;
      } else {
        // ── Hold: gentle ambient drift ─────────────────────────
        x += Math.sin(elapsed * 0.4 + i * 0.12) * 0.0008;
        y += Math.cos(elapsed * 0.3 + i * 0.15) * 0.0008;
        siz[i] = baseSizes[i] * 1.1;
      }

      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;
      velocities[idx] = vx;
      velocities[idx + 1] = vy;
      velocities[idx + 2] = vz;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    geom.setDrawRange(0, count);
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[data.colors, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[data.sizes, 1]}
        />
      </bufferGeometry>
    </points>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────────
function DissolveScene({
  exitingRef,
  audioEnabledRef,
  performanceTier,
}: {
  exitingRef: React.MutableRefObject<boolean>;
  audioEnabledRef: React.MutableRefObject<boolean>;
  performanceTier: "high" | "low";
}) {
  const { dispatch } = useExperience();
  const activeCountRef = useRef(MAX_PARTICLES);

  return (
    <PerformanceMonitor
      onDecline={() => {
        activeCountRef.current = Math.max(
          200,
          Math.floor(activeCountRef.current * 0.7)
        );
        dispatch({ type: "SET_PERFORMANCE_TIER", payload: "low" });
      }}
    >
      <DissolveParticles
        activeCountRef={activeCountRef}
        exitingRef={exitingRef}
        audioEnabledRef={audioEnabledRef}
      />
      {performanceTier === "high" && (
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        </EffectComposer>
      )}
      <AdaptiveDpr pixelated />
    </PerformanceMonitor>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function DissolveTransition() {
  const { state, dispatch } = useExperience();
  const [showText, setShowText] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const exitingRef = useRef(false);
  const audioEnabledRef = useRef(state.audioEnabled);
  audioEnabledRef.current = state.audioEnabled;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const textTimer = setTimeout(() => {
      setShowText(true);
      dispatch({ type: "UNLOCK_CANVAS" });
    }, HOLD_DURATION * 1000);

    const ctaTimer = setTimeout(() => setShowCta(true), CTA_DELAY * 1000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(ctaTimer);
    };
  }, [dispatch]);

  const handleContinue = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;

    setTimeout(() => {
      dispatch({ type: "SET_PHASE", payload: "canvas" });
    }, 600);
  }, [dispatch]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-transparent">
      {/* R3F particle scene — hidden entirely for reduced motion */}
      {!reducedMotion && (
        <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
            style={{ background: "#000000" }}
          >
            <DissolveScene
              exitingRef={exitingRef}
              audioEnabledRef={audioEnabledRef}
              performanceTier={state.performanceTier}
            />
          </Canvas>
        </Suspense>
      )}

      {/* DOM overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
        {showText && (
          <motion.p
            className="text-glow text-center font-display text-xl text-text md:text-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0.3 } : { duration: 1.2, ease: "easeOut" }}
          >
            you created something beautiful
          </motion.p>
        )}

        {showCta && (
          <motion.button
            className="pointer-events-auto mt-8 animate-breathe font-body text-sm text-accent hover-lift focus:outline-none"
            onClick={handleContinue}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0.3 } : { duration: 0.8, ease: "easeOut" }}
            aria-label="Continue to canvas"
          >
            keep going &rarr;
          </motion.button>
        )}
      </div>
    </div>
  );
}
