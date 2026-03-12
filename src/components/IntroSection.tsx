"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion } from "motion/react";
import { useMove } from "@use-gesture/react";
import { useExperience } from "@/lib/experience-state";
import { audioEngine } from "@/lib/audio-engine";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// ── Strand physics constants ─────────────────────────────────────────
const NUM_POINTS = 50;
const DAMPING = 0.03;
const STIFFNESS = 0.02;
const INFLUENCE_RADIUS = 150;
const IDLE_AMPLITUDE = 2.5;
const IDLE_FREQUENCY = 0.003;
const IDLE_SPEED = 0.0008;
const STRAND_COLOR = "#D4A574";
const GLOW_COLOR = "#E8C9A0";
const TRAIL_FRAMES = 3;

interface StrandPoint {
  x: number;
  y: number;
  prevY: number;
  restY: number;
}

export default function IntroSection() {
  const { state, dispatch } = useExperience();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<StrandPoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const timeRef = useRef(0);
  const exitingRef = useRef(false);
  const exitProgressRef = useRef(0);
  // Store previous frames for trail/ghost effect
  const trailBufferRef = useRef<{ y: number }[][]>([]);
  const [showCta, setShowCta] = useState(false);
  const reducedMotion = useReducedMotion();

  // Show CTA after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCta(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ── Initialise strand points ─────────────────────────────────────
  const initPoints = useCallback((width: number, height: number) => {
    const centerY = height / 2;
    const margin = width * 0.08;
    const usableWidth = width - margin * 2;
    const points: StrandPoint[] = [];

    for (let i = 0; i < NUM_POINTS; i++) {
      const x = margin + (usableWidth * i) / (NUM_POINTS - 1);
      points.push({ x, y: centerY, prevY: centerY, restY: centerY });
    }

    pointsRef.current = points;
    trailBufferRef.current = [];
  }, []);

  // ── Canvas setup + animation loop ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initPoints(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const points = pointsRef.current;
      const pointer = pointerRef.current;
      const time = timeRef.current;

      // ── Exit animation progress ──────────────────────────────
      if (exitingRef.current) {
        exitProgressRef.current = Math.min(
          exitProgressRef.current + 0.025,
          1
        );
      }
      const exitT = exitProgressRef.current;

      // ── Physics update (Verlet integration) ──────────────────
      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // 3 harmonics for organic movement:
        // fundamental + 2 overtones at lower amplitudes
        const phase = p.x * IDLE_FREQUENCY + time * IDLE_SPEED;
        const fundamental = Math.sin(phase) * IDLE_AMPLITUDE;
        const harmonic2 = Math.sin(phase * 2.17 + 0.5) * IDLE_AMPLITUDE * 0.35;
        const harmonic3 = Math.sin(phase * 3.31 + 1.2) * IDLE_AMPLITUDE * 0.15;
        const idleOffset = reducedMotion && !exitingRef.current
          ? 0
          : fundamental + harmonic2 + harmonic3;

        // During exit: amplify oscillation
        const exitAmplify = 1 + exitT * 12;
        const targetY = p.restY + idleOffset * exitAmplify;

        // Verlet velocity
        const velocity = (p.y - p.prevY) * (1 - DAMPING);

        // Spring force toward rest + idle
        const springForce = (targetY - p.y) * STIFFNESS;

        // Pointer influence
        let pointerForce = 0;
        if (pointer.active && !exitingRef.current) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < INFLUENCE_RADIUS) {
            const strength = 1 - dist / INFLUENCE_RADIUS;
            pointerForce = (pointer.y - p.y) * strength * 0.08;
          }
        }

        const newY = p.y + velocity + springForce + pointerForce;
        p.prevY = p.y;
        p.y = newY;
      }

      // ── Store frame for trail effect ───────────────────────────
      if (!reducedMotion) {
        const snapshot = points.map((p) => ({ y: p.y }));
        trailBufferRef.current.push(snapshot);
        if (trailBufferRef.current.length > TRAIL_FRAMES) {
          trailBufferRef.current.shift();
        }
      }

      // ── Draw trail/ghost frames ────────────────────────────────
      if (!reducedMotion) {
        const trails = trailBufferRef.current;
        for (let t = 0; t < trails.length - 1; t++) {
          const frame = trails[t];
          const trailAlpha = ((t + 1) / trails.length) * 0.12;
          const trailExitAlpha = exitingRef.current
            ? Math.max(0, trailAlpha * (1 - exitT * 1.8))
            : trailAlpha;

          ctx.save();
          ctx.globalAlpha = trailExitAlpha;
          ctx.strokeStyle = STRAND_COLOR;
          ctx.lineWidth = 1;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(points[0].x, frame[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            const cpX = (points[i].x + points[i + 1].x) / 2;
            const cpY = (frame[i].y + frame[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, frame[i].y, cpX, cpY);
          }
          ctx.lineTo(points[points.length - 1].x, frame[frame.length - 1].y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ── Draw main strand ───────────────────────────────────────
      const glowIntensity = 15 + exitT * 40;
      const lineWidth = 1.5 + exitT * 2;
      const alpha = exitingRef.current ? Math.max(0, 1 - exitT * 1.8) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = STRAND_COLOR;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = GLOW_COLOR;
      ctx.shadowBlur = glowIntensity;

      // Draw the curve twice for stronger glow
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {
          const cpX = (points[i].x + points[i + 1].x) / 2;
          const cpY = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, cpX, cpY);
        }

        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }

      ctx.restore();

      // ── Continue or finish ───────────────────────────────────
      if (exitingRef.current && exitT >= 1) {
        dispatch({ type: "SET_PHASE", payload: "prompt" });
        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initPoints, dispatch, reducedMotion]);

  // ── Unified pointer tracking via useMove ────────────────────────────
  const bind = useMove(({ xy: [x, y], active }) => {
    pointerRef.current = { x, y, active };
  });

  // ── Handlers ─────────────────────────────────────────────────────
  const handleBegin = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;

    // Initialise audio from user gesture (Tone.start() requirement)
    if (state.audioEnabled) {
      audioEngine.init();
    }
  }, [state.audioEnabled]);

  return (
    <motion.div
      className="relative flex min-h-dvh cursor-pointer items-center justify-center bg-transparent"
      onClick={handleBegin}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0.3 } : { duration: 0.6, ease: "easeInOut" }}
      role="button"
      tabIndex={0}
      aria-label="Begin the mindfulness experience"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleBegin(); }}
    >
      {/* Gesture tracking layer */}
      <div {...bind()} ref={rootRef} className="absolute inset-0" />

      {/* Strand canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      {/* Text overlay */}
      <div className="pointer-events-none relative z-10 flex flex-col items-center px-6 text-center">
        <motion.h1
          className="text-glow font-display text-4xl tracking-wide text-text md:text-6xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 1, delay: 0.3, ease: "easeOut" }}
        >
          elastic mindfulness
        </motion.h1>

        <motion.p
          className="mt-4 font-body text-sm text-muted md:text-base"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 1, delay: 0.8, ease: "easeOut" }}
        >
          a 60-second experiment in slowness
        </motion.p>

        {/* CTA — fades in after 2s */}
        {showCta && (
          <motion.p
            className="mt-16 animate-breathe font-body text-xs tracking-widest text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0.01 } : { duration: 1, ease: "easeOut" }}
          >
            tap to begin
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
