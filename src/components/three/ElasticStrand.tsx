"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import strandVert from "@/shaders/strand.vert";
import strandFrag from "@/shaders/strand.frag";
import { loadShader } from "@/lib/shader-utils";
import { getStrandColor, getGlowIntensity } from "@/lib/color-palettes";

// ── Spring oscillation constants ─────────────────────────────────────
const SPRING_K = 0.1;
const SPRING_DAMPING = 0.95;
const VIBRATION_DURATION = 2.0;

export interface StrandData {
  id: number;
  /** Anchor point (where the gesture started) */
  anchor: THREE.Vector3;
  /** End point (where the gesture released) */
  end: THREE.Vector3;
  /** Intermediate control points with perpendicular displacement */
  controlPoints: THREE.Vector3[];
  /** Speed at creation time (0 = slow, 1 = fast) */
  speed: number;
  /** Timestamp when the strand was released (synced to R3F clock) */
  releaseTime: number;
  /** Whether the strand is still vibrating */
  vibrating: boolean;
  /** Opacity for fade-in/fade-out */
  opacity: number;
  /** Whether this strand is fading out */
  fadingOut: boolean;
}

interface ElasticStrandProps {
  strand: StrandData;
  strandIndex: number;
  isPreview?: boolean;
  reducedMotion?: boolean;
}

export default function ElasticStrand({
  strand,
  strandIndex,
  isPreview = false,
  reducedMotion = false,
}: ElasticStrandProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const clockSyncedRef = useRef(false);

  // Per-strand color from palette system
  const strandColor = useMemo(() => getStrandColor(strand.speed), [strand.speed]);
  const glowIntensity = useMemo(() => getGlowIntensity(strand.speed), [strand.speed]);

  const material = useMemo(() => {
    const { vertexShader, fragmentShader } = loadShader(strandVert, strandFrag);
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVibration: { value: 0 },
        uThickness: { value: strand.speed < 0.5 ? 1.0 : 0.6 },
        uGlow: { value: glowIntensity },
        uColor: { value: strandColor },
        uOpacity: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [strandColor, glowIntensity, strand.speed]);

  // Dispose material on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  // Build initial curve from control points
  const curvePointsRef = useRef<THREE.Vector3[]>(
    [strand.anchor, ...strand.controlPoints, strand.end].map((p) => p.clone())
  );

  // Initialize velocities for spring simulation
  if (!velocitiesRef.current) {
    const pts = curvePointsRef.current;
    velocitiesRef.current = new Float32Array(pts.length * 3);
  }

  // Rest positions (the final settled positions)
  const restPoints = useMemo(
    () =>
      [strand.anchor, ...strand.controlPoints, strand.end].map((p) =>
        p.clone()
      ),
    [strand.anchor, strand.controlPoints, strand.end]
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const pts = curvePointsRef.current;
    const vels = velocitiesRef.current!;

    // Sync releaseTime to R3F clock on first frame
    if (strand.vibrating && !clockSyncedRef.current) {
      strand.releaseTime = time;
      clockSyncedRef.current = true;
    }

    // ── Vibration physics ──────────────────────────────────────
    let vibrationAmount = 0;
    if (reducedMotion && strand.vibrating) {
      // Skip vibration entirely for reduced motion
      for (let i = 0; i < pts.length; i++) {
        pts[i].copy(restPoints[i]);
      }
      strand.vibrating = false;
    } else if (strand.vibrating) {
      const elapsed = time - strand.releaseTime;
      if (elapsed < VIBRATION_DURATION) {
        vibrationAmount = Math.max(0, 1 - elapsed / VIBRATION_DURATION);
        const dampPower = Math.pow(SPRING_DAMPING, elapsed * 60);
        for (let i = 1; i < pts.length - 1; i++) {
          const idx = i * 3;
          const dx = restPoints[i].x - pts[i].x;
          const dy = restPoints[i].y - pts[i].y;
          const dz = restPoints[i].z - pts[i].z;

          vels[idx] += dx * SPRING_K;
          vels[idx + 1] += dy * SPRING_K;
          vels[idx + 2] += dz * SPRING_K;

          vels[idx] *= SPRING_DAMPING;
          vels[idx + 1] *= SPRING_DAMPING;
          vels[idx + 2] *= SPRING_DAMPING;

          pts[i].x += vels[idx] * dampPower;
          pts[i].y += vels[idx + 1] * dampPower;
          pts[i].z += vels[idx + 2] * dampPower;
        }
      } else {
        // Settled — snap to rest
        for (let i = 0; i < pts.length; i++) {
          pts[i].copy(restPoints[i]);
        }
        strand.vibrating = false;
      }
    }

    // ── Ambient wave motion ────────────────────────────────────
    if (!strand.vibrating) {
      for (let i = 1; i < pts.length - 1; i++) {
        const wave =
          Math.sin(time * 0.6 + strandIndex * 1.7 + i * 0.8) * 0.008 +
          Math.sin(time * 0.3 + i * 1.3) * 0.005;
        pts[i].y = restPoints[i].y + wave;
        pts[i].x = restPoints[i].x + Math.cos(time * 0.4 + i * 0.9) * 0.003;
      }
    }

    // ── Rebuild geometry ───────────────────────────────────────
    const curve = new THREE.CatmullRomCurve3(pts);
    const radius = isPreview ? 0.02 : strand.speed < 0.5 ? 0.06 : 0.025;
    const newGeom = new THREE.TubeGeometry(curve, 48, radius, 12, false);
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = newGeom;

    // ── Update uniforms ────────────────────────────────────────
    material.uniforms.uTime.value = time;
    material.uniforms.uVibration.value = vibrationAmount;

    // Fade opacity
    const targetOpacity = strand.fadingOut
      ? 0
      : isPreview
        ? 0.4
        : 0.85 + glowIntensity * 0.15;
    strand.opacity += (targetOpacity - strand.opacity) * 0.08;
    material.uniforms.uOpacity.value = strand.opacity;
  });

  // Initial geometry
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(curvePointsRef.current);
    const radius = isPreview ? 0.02 : strand.speed < 0.5 ? 0.06 : 0.025;
    return new THREE.TubeGeometry(curve, 48, radius, 12, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
