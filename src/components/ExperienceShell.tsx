"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { ExperienceProvider, useExperience } from "@/lib/experience-state";
import { audioEngine } from "@/lib/audio-engine";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import IntroSection from "@/components/IntroSection";
import ThoughtPrompt from "@/components/ThoughtPrompt";
import ShareOverlay from "@/components/ShareOverlay";

// ── Heavy R3F components loaded dynamically ───────────────────────────
const BreathExercise = dynamic(() => import("@/components/BreathExercise"), {
  ssr: false,
  loading: () => <PhaseLoadingState />,
});

const DissolveTransition = dynamic(
  () => import("@/components/DissolveTransition"),
  {
    ssr: false,
    loading: () => <PhaseLoadingState />,
  }
);

const ElasticCanvas = dynamic(() => import("@/components/ElasticCanvas"), {
  ssr: false,
  loading: () => <PhaseLoadingState />,
});

function PhaseLoadingState() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <p className="animate-pulse font-body text-sm text-muted">loading...</p>
    </div>
  );
}

// ── Preload helpers — warm-import chunks without rendering ────────────
const preloadBreath = () => import("@/components/BreathExercise");
const preloadDissolve = () => import("@/components/DissolveTransition");
const preloadCanvas = () => import("@/components/ElasticCanvas");

function usePhasePreload(phase: string) {
  useEffect(() => {
    switch (phase) {
      case "intro":
        preloadBreath();
        break;
      case "prompt":
        preloadBreath();
        break;
      case "breathe":
        preloadDissolve();
        preloadCanvas();
        break;
      case "dissolve":
        preloadCanvas();
        break;
    }
  }, [phase]);
}

// ── Transition pulse overlay ──────────────────────────────────────────
function TransitionPulse({ phase }: { phase: string }) {
  const [pulseKey, setPulseKey] = useState(0);
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      setPulseKey((k) => k + 1);
    }
  }, [phase]);

  if (pulseKey === 0) return null;

  return (
    <div
      key={pulseKey}
      className="transition-pulse pointer-events-none absolute inset-0 z-30"
      aria-hidden="true"
    />
  );
}

// ── Global sound toggle (visible on all phases) ──────────────────────
function SoundToggle() {
  const { state, dispatch } = useExperience();

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({ type: "TOGGLE_AUDIO" });
      if (!state.audioEnabled) {
        audioEngine.init();
      }
    },
    [dispatch, state.audioEnabled]
  );

  // Hide during share overlay (it has its own UI)
  if (state.phase === "share") return null;

  return (
    <motion.button
      className="pointer-events-auto fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full hover-lift"
      onClick={handleToggle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      whileHover={{ opacity: 0.8 }}
      transition={{ duration: 0.6, delay: 1.5 }}
      aria-label={state.audioEnabled ? "Mute sound" : "Enable sound"}
    >
      {state.audioEnabled ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666655"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666655"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </motion.button>
  );
}

function PhaseRenderer() {
  const { state } = useExperience();
  const reducedMotion = useReducedMotion();

  // Preload upcoming phases
  usePhasePreload(state.phase);

  // Adjust ambient drone on phase transitions
  useEffect(() => {
    if (state.audioEnabled) {
      audioEngine.setPhase(state.phase);
    }
  }, [state.phase, state.audioEnabled]);

  const phaseComponent = () => {
    switch (state.phase) {
      case "intro":
        return <IntroSection />;
      case "prompt":
        return <ThoughtPrompt />;
      case "breathe":
        return <BreathExercise />;
      case "dissolve":
        return <DissolveTransition />;
      case "canvas":
        return <ElasticCanvas />;
      case "share":
        return <ShareOverlay />;
    }
  };

  const transition = reducedMotion
    ? { duration: 0.3 }
    : { duration: 0.5, ease: "easeOut" as const };

  return (
    <>
      {/* Transition pulse on phase change */}
      {!reducedMotion && <TransitionPulse phase={state.phase} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="absolute inset-0"
        >
          {phaseComponent()}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function ExperienceShell() {
  return (
    <ExperienceProvider>
      <SkipToCanvas />
      <div className="relative min-h-dvh overflow-hidden bg-background">
        {/* Nebula background — subtle atmospheric gradient behind all phases */}
        <div
          className="nebula-bg pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        />

        <PhaseRenderer />

        {/* Global sound toggle */}
        <SoundToggle />
      </div>
    </ExperienceProvider>
  );
}

function SkipToCanvas() {
  const { dispatch } = useExperience();

  return (
    <a
      href="#"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-accent"
      onClick={(e) => {
        e.preventDefault();
        dispatch({ type: "SET_PHASE", payload: "canvas" });
      }}
    >
      Skip to canvas
    </a>
  );
}
