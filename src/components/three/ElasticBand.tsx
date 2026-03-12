"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import elasticVert from "@/shaders/elastic.vert";
import elasticFrag from "@/shaders/elastic.frag";
import { loadShader, createElasticMaterial } from "@/lib/shader-utils";

interface ElasticBandProps {
  stretchRef: React.MutableRefObject<number>;
}

export default function ElasticBand({ stretchRef }: ElasticBandProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.5, 0, 0),
      new THREE.Vector3(-0.75, 0.02, 0.02),
      new THREE.Vector3(0, 0, -0.02),
      new THREE.Vector3(0.75, -0.02, 0.02),
      new THREE.Vector3(1.5, 0, 0),
    ]);
    return new THREE.TubeGeometry(curve, 64, 0.12, 16, false);
  }, []);

  const material = useMemo(() => {
    const { vertexShader, fragmentShader } = loadShader(elasticVert, elasticFrag);
    return createElasticMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uStretch: { value: 0 },
        uTime: { value: 0 },
        uWobble: { value: 0.06 },
        uBaseColor: { value: new THREE.Color(0xd4a574) },
        uGlowColor: { value: new THREE.Color(0xe8c9a0) },
      },
    });
  }, []);

  // Dispose geometry and material on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    material.uniforms.uStretch.value = stretchRef.current;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.15}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </Float>
  );
}
