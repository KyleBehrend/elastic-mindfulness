import * as THREE from "three";
import noiseGlsl from "@/shaders/noise.glsl";

/**
 * Resolve `#include <noise>` directives by inlining the noise.glsl source.
 * Extend the map below to support additional shared chunks.
 */
const includes: Record<string, string> = {
  noise: noiseGlsl,
};

function resolveIncludes(source: string): string {
  return source.replace(
    /^#include\s+<(\w+)>/gm,
    (_, name: string) => includes[name] ?? `// ERROR: unknown include <${name}>`
  );
}

/**
 * Process vertex + fragment shader source strings, resolving any
 * `#include <...>` directives found in either.
 */
export function loadShader(
  vert: string,
  frag: string
): { vertexShader: string; fragmentShader: string } {
  return {
    vertexShader: resolveIncludes(vert),
    fragmentShader: resolveIncludes(frag),
  };
}

/**
 * Create a THREE.ShaderMaterial with sensible defaults for the
 * elastic‑mindfulness aesthetic: transparent, double‑sided,
 * premultiplied alpha blending.
 */
export function createElasticMaterial(options: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: options.vertexShader,
    fragmentShader: options.fragmentShader,
    uniforms: options.uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    premultipliedAlpha: true,
  });
}
