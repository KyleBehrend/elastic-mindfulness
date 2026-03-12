"use client";

import {
  Suspense,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useDrag } from "@use-gesture/react";
import { motion, AnimatePresence } from "motion/react";
import { useExperience } from "@/lib/experience-state";
import { SpeedTracker } from "@/lib/speed-tracker";
import { audioEngine } from "@/lib/audio-engine";
import { applySymmetry, type SymmetryMode } from "@/lib/symmetry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import ElasticStrand, { type StrandData } from "@/components/three/ElasticStrand";
import { setLastCapture } from "@/lib/canvas-export";
import * as THREE from "three";

// ── Constants ────────────────────────────────────────────────────────
const MAX_STRANDS = 30;
const UI_FADE_DELAY = 3000;
const DUST_COUNT = 20;

// ── Ambient particle dust — barely visible, slow upward drift ────────
function ParticleDust() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, sizes, opacities } = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    const siz = new Float32Array(DUST_COUNT);
    const opa = new Float32Array(DUST_COUNT);

    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 - 1;
      siz[i] = 0.5 + Math.random() * 1.0;
      opa[i] = 0.03 + Math.random() * 0.04;
    }
    return { positions: pos, sizes: siz, opacities: opa };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (200.0 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vOpacity;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float alpha = (1.0 - smoothstep(0.1, 0.5, d)) * vOpacity;
            gl_FragColor = vec4(0.83, 0.65, 0.45, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const posArr = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < DUST_COUNT; i++) {
      const idx = i * 3;
      // Slow upward drift with gentle horizontal sway
      posArr[idx] += Math.sin(t * 0.2 + i * 1.7) * 0.0003;
      posArr[idx + 1] += 0.0008 + Math.sin(t * 0.15 + i * 2.3) * 0.0002;

      // Wrap around when out of view
      if (posArr[idx + 1] > 3.5) {
        posArr[idx + 1] = -3.5;
        posArr[idx] = (Math.random() - 0.5) * 8;
      }
    }

    (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
    </points>
  );
}

// ── Guide curves — dim ghost strands that hint at drawing ────────────
function GuideCurves({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const fadingRef = useRef(false);
  const opacityRef = useRef(0);

  useEffect(() => {
    if (!visible) fadingRef.current = true;
  }, [visible]);

  const lines = useMemo(() => {
    const defs = [
      { yOff: 0, ampScale: 1, phaseOff: 0 },
      { yOff: 0.6, ampScale: 0.7, phaseOff: 2.1 },
      { yOff: -0.5, ampScale: 0.8, phaseOff: 4.2 },
    ];

    return defs.map((def) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = -2 + t * 4;
        const y = def.yOff + Math.sin(t * Math.PI * 2 + def.phaseOff) * 0.3 * def.ampScale;
        pts.push(new THREE.Vector3(x, y, 0));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
      const mat = new THREE.LineBasicMaterial({
        color: 0xD4A574,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Line(geom, mat);
    });
  }, []);

  useEffect(() => {
    return () => {
      lines.forEach((l) => { l.geometry.dispose(); (l.material as THREE.LineBasicMaterial).dispose(); });
    };
  }, [lines]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    if (fadingRef.current) {
      opacityRef.current = Math.max(0, opacityRef.current - 0.02);
    } else if (visible) {
      opacityRef.current = Math.min(0.08, opacityRef.current + 0.001);
    }

    lines.forEach((line, i) => {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = opacityRef.current * (0.6 + Math.sin(t * 0.3 + i * 1.5) * 0.4);
    });
  });

  if (opacityRef.current <= 0 && fadingRef.current) return null;

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

// ── Mandala background (faint rotating particle ring) ────────────────
function MandalaBackground({ hidden }: { hidden?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const RINGS = 5;
    const SYMMETRY = 6;
    const radii = [0.3, 0.7, 1.2, 1.8, 2.4];

    let idx = 0;
    for (let ring = 0; ring < RINGS; ring++) {
      const perRing = Math.floor(count / RINGS);
      for (let j = 0; j < perRing && idx < count; j++) {
        const petal = j % SYMMETRY;
        const petalBase = (petal / SYMMETRY) * Math.PI * 2;
        const spread = ((j / perRing) * Math.PI * 2) / SYMMETRY;
        const angle = petalBase + spread + (Math.random() - 0.5) * 0.1;
        const r = radii[ring] + (Math.random() - 0.5) * 0.15;

        pos[idx * 3] = Math.cos(angle) * r;
        pos[idx * 3 + 1] = Math.sin(angle) * r;
        pos[idx * 3 + 2] = 0;

        col[idx * 3] = 0.83 + Math.random() * 0.1;
        col[idx * 3 + 1] = 0.65 + Math.random() * 0.1;
        col[idx * 3 + 2] = 0.45 + Math.random() * 0.1;

        siz[idx] = 1.0 + Math.random() * 2.0;
        idx++;
      }
    }
    return { positions: pos, colors: col, sizes: siz };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute vec3 aColor;
          varying vec3 vColor;
          void main() {
            vColor = aColor;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (200.0 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.1, 0.5, d);
            gl_FragColor = vec4(vColor, alpha * 0.1);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.z = state.clock.getElapsedTime() * 0.015;
  });

  if (hidden) return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
    </points>
  );
}

// ── Screen-to-world coordinate conversion ────────────────────────────
function useScreenToWorld() {
  const { viewport } = useThree();
  return useCallback(
    (screenX: number, screenY: number, canvasEl: HTMLElement) => {
      const rect = canvasEl.getBoundingClientRect();
      const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;
      const worldX = ndcX * (viewport.width / 2);
      const worldY = ndcY * (viewport.height / 2);
      return new THREE.Vector3(worldX, worldY, 0);
    },
    [viewport]
  );
}

// ── Generate intermediate control points with speed-based displacement ─
function buildControlPoints(
  anchor: THREE.Vector3,
  end: THREE.Vector3,
  speed: number
): THREE.Vector3[] {
  const count = 4;
  const points: THREE.Vector3[] = [];
  const dir = end.clone().sub(anchor);
  const len = dir.length();
  const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();

  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const base = anchor.clone().lerp(end, t);

    const smoothDisp = Math.sin(t * Math.PI) * len * 0.2 * (1 - speed);
    const jitter = speed * (Math.random() - 0.5) * len * 0.15;

    base.add(perp.clone().multiplyScalar(smoothDisp + jitter));
    base.z = Math.sin(t * Math.PI * 2) * 0.05 * (1 - speed);

    points.push(base);
  }

  return points;
}

// ── Strand scene (manages drawing + completed strands) ───────────────
function StrandScene({
  strandsRef,
  previewStrandRef,
  symmetryRef,
  performanceTier,
  reducedMotion,
}: {
  strandsRef: React.MutableRefObject<StrandData[]>;
  previewStrandRef: React.MutableRefObject<StrandData | null>;
  symmetryRef: React.MutableRefObject<SymmetryMode>;
  performanceTier: "high" | "low";
  reducedMotion: boolean;
}) {
  const { dispatch } = useExperience();
  const [, setTick] = useState(0);
  const screenToWorld = useScreenToWorld();

  const storeRef = useRef<{
    screenToWorld: ReturnType<typeof useScreenToWorld>;
  }>({ screenToWorld });
  storeRef.current.screenToWorld = screenToWorld;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__elasticScreenToWorld = storeRef.current;
  }, []);

  // Force re-render loop to pick up strand mutations
  useFrame(() => {
    setTick((t) => t + 1);
  });

  const strands = strandsRef.current;
  const preview = previewStrandRef.current;
  const sym = symmetryRef.current;
  const hasStrands = strands.length > 0 || preview !== null;

  return (
    <PerformanceMonitor
      onDecline={() => {
        dispatch({ type: "SET_PERFORMANCE_TIER", payload: "low" });
      }}
    >
      <MandalaBackground hidden={reducedMotion} />

      {/* Ambient particle dust */}
      {!reducedMotion && <ParticleDust />}

      {/* Guide curves — visible only when canvas is empty */}
      {!reducedMotion && <GuideCurves visible={!hasStrands} />}

      {/* Completed strands with symmetry */}
      {strands.map((strand) => {
        const copies = applySymmetry(
          {
            anchor: strand.anchor,
            end: strand.end,
            controlPoints: strand.controlPoints,
          },
          sym
        );
        return copies.map((copy, ci) => (
          <ElasticStrand
            key={`${strand.id}-${ci}`}
            strand={{
              ...strand,
              anchor: copy.anchor,
              end: copy.end,
              controlPoints: copy.controlPoints,
            }}
            strandIndex={strand.id * 10 + ci}
            reducedMotion={reducedMotion}
          />
        ));
      })}

      {/* Preview strand (currently being drawn) */}
      {preview &&
        applySymmetry(
          {
            anchor: preview.anchor,
            end: preview.end,
            controlPoints: preview.controlPoints,
          },
          sym
        ).map((copy, ci) => (
          <ElasticStrand
            key={`preview-${ci}`}
            strand={{
              ...preview,
              anchor: copy.anchor,
              end: copy.end,
              controlPoints: copy.controlPoints,
            }}
            strandIndex={999 + ci}
            isPreview
          />
        ))}

      {performanceTier === "high" && (
        <EffectComposer>
          <Bloom
            intensity={0.7}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
      )}
      <AdaptiveDpr pixelated />
    </PerformanceMonitor>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function ElasticCanvas() {
  const { state, dispatch } = useExperience();
  const reducedMotion = useReducedMotion();

  // Strand state (using refs for performance — mutated in animation loop)
  const strandsRef = useRef<StrandData[]>([]);
  const previewStrandRef = useRef<StrandData | null>(null);
  const nextIdRef = useRef(1);
  const speedTracker = useRef(new SpeedTracker());
  const canvasElRef = useRef<HTMLDivElement>(null);

  // Symmetry
  const [symmetry, setSymmetry] = useState<SymmetryMode>("mirror");
  const symmetryRef = useRef<SymmetryMode>("mirror");
  useEffect(() => {
    symmetryRef.current = symmetry;
  }, [symmetry]);

  // UI visibility (fade after inactivity)
  const [uiVisible, setUiVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showUI = useCallback(() => {
    setUiVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setUiVisible(false), UI_FADE_DELAY);
  }, []);

  useEffect(() => {
    showUI();
    const handler = () => showUI();
    window.addEventListener("mousemove", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("touchstart", handler);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showUI]);

  // Onboarding hint
  const [showHint, setShowHint] = useState(true);
  const hasDrawnRef = useRef(false);

  // Clear confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClear = useCallback(() => {
    strandsRef.current.forEach((s) => {
      s.fadingOut = true;
    });
    setTimeout(() => {
      strandsRef.current = [];
    }, 800);
    setShowClearConfirm(false);
  }, []);

  // ── Drag gesture ───────────────────────────────────────────────
  const bind = useDrag(
    ({ event, first, last, xy: [sx, sy], memo }) => {
      event?.preventDefault?.();
      showUI();

      const canvasEl = canvasElRef.current?.querySelector("canvas");
      if (!canvasEl) return memo;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const converter = (window as any).__elasticScreenToWorld;
      if (!converter?.screenToWorld) return memo;

      const worldPos = converter.screenToWorld(sx, sy, canvasEl);

      if (first) {
        if (!hasDrawnRef.current) {
          hasDrawnRef.current = true;
          setShowHint(false);
        }
        speedTracker.current.reset();
        speedTracker.current.addPoint(sx, sy, performance.now());

        const anchor = worldPos.clone();
        previewStrandRef.current = {
          id: nextIdRef.current,
          anchor,
          end: worldPos.clone(),
          controlPoints: [],
          speed: 0,
          releaseTime: 0,
          vibrating: false,
          opacity: 0,
          fadingOut: false,
        };
        return { anchor };
      }

      // During drag — update preview
      speedTracker.current.addPoint(sx, sy, performance.now());
      const speed = speedTracker.current.getSmoothedSpeed();

      if (previewStrandRef.current && memo?.anchor) {
        const anchor = memo.anchor as THREE.Vector3;
        const controlPts = buildControlPoints(anchor, worldPos, speed);
        previewStrandRef.current = {
          ...previewStrandRef.current,
          end: worldPos.clone(),
          controlPoints: controlPts,
          speed,
        };
      }

      if (last && previewStrandRef.current && memo?.anchor) {
        const avgSpeed = speedTracker.current.getAverageSpeed();
        const anchor = memo.anchor as THREE.Vector3;
        const controlPts = buildControlPoints(anchor, worldPos, avgSpeed);

        const perpDir = new THREE.Vector3(
          -(worldPos.y - anchor.y),
          worldPos.x - anchor.x,
          0
        ).normalize();

        const vibratingPts = controlPts.map((p, i) => {
          const t = (i + 1) / (controlPts.length + 1);
          const pluckForce = Math.sin(t * Math.PI) * 0.15 * (1 - avgSpeed * 0.7);
          return p.clone().add(perpDir.clone().multiplyScalar(pluckForce));
        });

        const strand: StrandData = {
          id: nextIdRef.current++,
          anchor,
          end: worldPos.clone(),
          controlPoints: vibratingPts,
          speed: avgSpeed,
          releaseTime: 0,
          vibrating: !reducedMotion,
          opacity: 0,
          fadingOut: false,
        };

        const arr = strandsRef.current;
        if (arr.length >= MAX_STRANDS) {
          arr[0].fadingOut = true;
          setTimeout(() => {
            strandsRef.current = strandsRef.current.filter(
              (s) => s !== arr[0]
            );
          }, 600);
        }
        arr.push(strand);

        if (state.audioEnabled) {
          const strandLength = anchor.distanceTo(worldPos);
          audioEngine.triggerPluck(strandLength, avgSpeed);
        }

        previewStrandRef.current = null;
      }

      return memo;
    },
    {
      pointer: { touch: true },
      filterTaps: true,
    }
  );

  return (
    <div
      ref={canvasElRef}
      className="relative h-dvh w-screen overflow-hidden bg-transparent"
    >
      {/* R3F scene */}
      <Suspense
        fallback={<div className="absolute inset-0 bg-background" />}
      >
        <div {...bind()} className="absolute inset-0 touch-none">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            dpr={[1, 2]}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            style={{ background: "#000000" }}
          >
            <StrandScene
              strandsRef={strandsRef}
              previewStrandRef={previewStrandRef}
              symmetryRef={symmetryRef}
              performanceTier={state.performanceTier}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        </div>
      </Suspense>

      {/* DOM overlay */}
      <div className="pointer-events-none absolute inset-0">
        {/* Onboarding hint */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              className="text-backdrop absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="animate-breathe font-body text-sm tracking-widest text-muted">
                drag to create elastic strands
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {uiVisible && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reducedMotion ? { duration: 0.3 } : { duration: 0.6 }}
            >
              {/* Top-left: title */}
              <p className="absolute left-4 top-4 font-body text-xs text-muted opacity-30 select-none">
                elastic canvas
              </p>

              {/* Top-right: clear */}
              <button
                className="pointer-events-auto absolute right-4 top-4 font-body text-xs text-muted opacity-30 transition-opacity hover:opacity-60"
                onClick={() => {
                  if (strandsRef.current.length === 0) return;
                  setShowClearConfirm(true);
                }}
                aria-label="Clear all strands"
              >
                clear
              </button>

              {/* Bottom-left: symmetry toggle */}
              <div className="pointer-events-auto absolute bottom-4 left-4 flex gap-3">
                {(["mirror", "mandala", "free"] as SymmetryMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      className={`font-body text-xs transition-opacity ${
                        symmetry === mode
                          ? "text-accent opacity-60"
                          : "text-muted opacity-30 hover:opacity-50"
                      }`}
                      onClick={() => setSymmetry(mode)}
                      aria-label={`${mode} symmetry${symmetry === mode ? " (active)" : ""}`}
                    >
                      {mode === "mirror" && (
                        <span title="Mirror symmetry">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          >
                            <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2 2" />
                            <path d="M5 4L3 8L5 12" />
                            <path d="M11 4L13 8L11 12" />
                          </svg>
                        </span>
                      )}
                      {mode === "mandala" && (
                        <span title="Mandala symmetry">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          >
                            <circle cx="8" cy="8" r="5" />
                            <line x1="8" y1="3" x2="8" y2="13" />
                            <line x1="3.67" y1="5.5" x2="12.33" y2="10.5" />
                            <line x1="3.67" y1="10.5" x2="12.33" y2="5.5" />
                          </svg>
                        </span>
                      )}
                      {mode === "free" && (
                        <span title="Freeform">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          >
                            <path d="M3 12C5 4 11 4 13 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>

              {/* Bottom-right: share (offset left for sound toggle) */}
              <button
                className="pointer-events-auto absolute bottom-4 right-16 font-body text-sm text-accent opacity-60 hover-lift"
                onClick={() => {
                  const canvas =
                    canvasElRef.current?.querySelector("canvas");
                  if (canvas) {
                    setLastCapture(canvas.toDataURL("image/png"));
                  }
                  dispatch({ type: "SET_PHASE", payload: "share" });
                }}
                aria-label="Share your creation"
              >
                share
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clear confirmation overlay */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              className="pointer-events-auto absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col items-center gap-4">
                <p className="font-body text-sm text-text opacity-70">
                  clear all strands?
                </p>
                <div className="flex gap-6">
                  <button
                    className="font-body text-sm text-accent opacity-70 hover-lift"
                    onClick={handleClear}
                    aria-label="Confirm clear all strands"
                  >
                    yes, clear
                  </button>
                  <button
                    className="font-body text-sm text-muted opacity-50 hover-lift"
                    onClick={() => setShowClearConfirm(false)}
                    aria-label="Cancel clearing strands"
                  >
                    cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
