"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DEFAULT_PARTICLE_COUNT = 40;

interface BreathParticlesProps {
  stretchRef: React.MutableRefObject<number>;
  isInhalingRef: React.MutableRefObject<boolean>;
  tapSparkleRef: React.MutableRefObject<number>;
  particleCount?: number;
}

export default function BreathParticles({
  stretchRef,
  isInhalingRef,
  tapSparkleRef,
  particleCount = DEFAULT_PARTICLE_COUNT,
}: BreathParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, basePositions } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const basePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1.5;
      const x = (Math.random() - 0.5) * 3.5;
      const y = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      basePositions[idx] = x;
      basePositions[idx + 1] = y;
      basePositions[idx + 2] = z;
    }

    return { positions, basePositions };
  }, [particleCount]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const isInhaling = isInhalingRef.current;
    const stretch = stretchRef.current;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      let x = arr[idx];
      let y = arr[idx + 1];
      let z = arr[idx + 2];

      const dist = Math.sqrt(y * y + z * z);

      if (isInhaling) {
        // Drift inward — stronger pull at higher stretch
        const pull = 0.997 - stretch * 0.002;
        if (dist > 0.2) {
          y *= pull;
          z *= pull;
        }
      } else {
        // Scatter outward, drifting back toward base positions
        const scatter = 0.012 + (1 - stretch) * 0.005;
        const baseY = basePositions[idx + 1];
        const baseZ = basePositions[idx + 2];
        y += (baseY - y) * scatter + Math.sin(time * 0.7 + i) * 0.003;
        z += (baseZ - z) * scatter + Math.cos(time * 0.7 + i) * 0.003;
      }

      // Gentle wander along X
      x += Math.sin(time * 0.3 + i * 0.8) * 0.001;

      arr[idx] = x;
      arr[idx + 1] = y;
      arr[idx + 2] = z;
    }

    posAttr.needsUpdate = true;

    // Tap sparkle — briefly boost opacity and size, then decay
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    const sparkle = tapSparkleRef.current;
    mat.opacity = 0.3 + sparkle * 0.5;
    mat.size = 0.03 + sparkle * 0.03;
    tapSparkleRef.current *= 0.94;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#D4A574"
        size={0.03}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
