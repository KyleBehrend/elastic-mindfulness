"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { AnimatePresence, motion } from "motion/react";
import { useExperience } from "@/lib/experience-state";
import { audioEngine } from "@/lib/audio-engine";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useWindowSize } from "@/hooks/useWindowSize";
import ElasticBand from "@/components/three/ElasticBand";
import BreathParticles from "@/components/three/BreathParticles";

// ── Timing constants ─────────────────────────────────────────────────
const INHALE_MS = 4000;
const EXHALE_MS = 4000;
const CYCLE_MS = INHALE_MS + EXHALE_MS;
const TOTAL_CYCLES = 5;
const HOLD_MS = 1000;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Scene contents (inside Canvas) ───────────────────────────────────
function BreathScene({
  stretchRef,
  isInhalingRef,
  tapSparkleRef,
  performanceTier,
  reducedMotion,
}: {
  stretchRef: React.MutableRefObject<number>;
  isInhalingRef: React.MutableRefObject<boolean>;
  tapSparkleRef: React.MutableRefObject<number>;
  performanceTier: "high" | "low";
  reducedMotion: boolean;
}) {
  const { dispatch } = useExperience();

  return (
    <PerformanceMonitor
      onDecline={() => {
        dispatch({ type: "SET_PERFORMANCE_TIER", payload: "low" });
      }}
    >
      <ElasticBand stretchRef={stretchRef} />
      {!reducedMotion && (
        <BreathParticles
          stretchRef={stretchRef}
          isInhalingRef={isInhalingRef}
          tapSparkleRef={tapSparkleRef}
          particleCount={performanceTier === "low" ? 20 : 40}
        />
      )}
      {performanceTier === "high" && (
        <EffectComposer>
          <Bloom
            intensity={reducedMotion ? 0 : 0.3}
            luminanceThreshold={0.8}
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
export default function BreathExercise() {
  const { state, dispatch } = useExperience();
  const reducedMotion = useReducedMotion();
  const { isLandscape } = useWindowSize();

  // Shared refs between rAF loop and R3F scene
  const stretchRef = useRef(0);
  const isInhalingRef = useRef(true);
  const tapBonusRef = useRef(0);
  const tapSparkleRef = useRef(0);
  const audioEnabledRef = useRef(state.audioEnabled);
  audioEnabledRef.current = state.audioEnabled;

  // DOM state (updated at cycle boundaries, not per-frame)
  const [isInhaling, setIsInhaling] = useState(true);
  const [completedCycles, setCompletedCycles] = useState(0);

  // ── Breath timing loop ─────────────────────────────────────────
  useEffect(() => {
    const startTime = performance.now();
    let lastCycle = -1;
    let frameId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const cycleIndex = Math.floor(elapsed / CYCLE_MS);

      // ── All cycles done — hold then transition ──────────────
      if (cycleIndex >= TOTAL_CYCLES) {
        stretchRef.current = 0;

        // Increment for the final cycle if we haven't yet
        if (lastCycle < TOTAL_CYCLES) {
          lastCycle = TOTAL_CYCLES;
          dispatch({ type: "INCREMENT_BREATH" });
          setCompletedCycles(TOTAL_CYCLES);
          setIsInhaling(false);
          isInhalingRef.current = false;
        }

        const holdElapsed = elapsed - TOTAL_CYCLES * CYCLE_MS;
        if (holdElapsed >= HOLD_MS) {
          dispatch({ type: "SET_PHASE", payload: "dissolve" });
          return;
        }

        frameId = requestAnimationFrame(tick);
        return;
      }

      // ── Cycle boundary — update React state ─────────────────
      if (cycleIndex > lastCycle) {
        if (lastCycle >= 0) {
          dispatch({ type: "INCREMENT_BREATH" });
        }
        lastCycle = cycleIndex;
        setCompletedCycles(cycleIndex);

        // Haptic feedback at cycle boundary
        try { navigator.vibrate?.(100); } catch {}
      }

      // ── Compute stretch ─────────────────────────────────────
      const cycleProgress = (elapsed % CYCLE_MS) / CYCLE_MS;
      const inhaling = cycleProgress < 0.5;

      if (inhaling !== isInhalingRef.current) {
        isInhalingRef.current = inhaling;
        setIsInhaling(inhaling);

        // Breath sync audio
        if (audioEnabledRef.current) {
          if (inhaling) {
            audioEngine.triggerInhale();
          } else {
            audioEngine.triggerExhale();
          }
        }
      }

      let stretch: number;
      if (inhaling) {
        stretch = easeInOutCubic(cycleProgress * 2);
      } else {
        stretch = 1 - easeInOutCubic((cycleProgress - 0.5) * 2);
      }

      // Tap bonus (decays each frame)
      tapBonusRef.current *= 0.95;
      stretch = Math.min(stretch + tapBonusRef.current, 1.1);

      stretchRef.current = stretch;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [dispatch]);

  // ── Tap handler ────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (isInhalingRef.current) {
      tapBonusRef.current = 0.1;
    } else {
      tapSparkleRef.current = 1;
    }
  }, []);

  // ── Derived values ─────────────────────────────────────────────
  const thoughtOpacity = Math.max(0, 1 - completedCycles * 0.2);

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden bg-transparent"
      onClick={handleTap}
      role="timer"
      aria-label="Breathing exercise"
    >
      {/* R3F Canvas */}
      <Suspense
        fallback={<div className="absolute inset-0 bg-background" />}
      >
        <Canvas
          camera={{
            position: [0, 0, 5],
            fov: isLandscape ? 55 : 45,
          }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          style={{ background: "#000000" }}
        >
          <BreathScene
            stretchRef={stretchRef}
            isInhalingRef={isInhalingRef}
            tapSparkleRef={tapSparkleRef}
            performanceTier={state.performanceTier}
            reducedMotion={reducedMotion}
          />
        </Canvas>
      </Suspense>

      {/* DOM overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-6 py-20">
        {/* User's thought — dissolves with each cycle */}
        <motion.p
          className="text-glow max-w-sm text-center font-display text-xl text-text md:text-2xl"
          animate={{ opacity: thoughtOpacity }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          {state.userThought}
        </motion.p>

        {/* Breath instruction */}
        <div className="flex h-8 items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={isInhaling ? "in" : "out"}
              className="font-body text-sm tracking-widest text-muted"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={reducedMotion ? { duration: 0.01 } : { duration: 0.4, ease: "easeOut" }}
            >
              {isInhaling ? "breathe in\u2026" : "let go\u2026"}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="flex gap-3" role="progressbar" aria-valuenow={completedCycles} aria-valuemax={TOTAL_CYCLES} aria-label="Breathing cycles completed">
          {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors duration-700 ${
                i < completedCycles ? "bg-accent" : "bg-muted/30"
              }`}
              aria-label={`Cycle ${i + 1} ${i < completedCycles ? "completed" : "remaining"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
