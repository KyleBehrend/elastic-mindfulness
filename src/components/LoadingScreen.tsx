"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  // Simulate resource loading progress
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const duration = 1800; // ms to fill the bar

    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out curve for natural feel
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setReady(true);
      }
    };

    // Wait for fonts to be ready before starting progress
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        frame = requestAnimationFrame(tick);
      });
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, []);

  const handleExitComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!ready ? (
        <motion.div
          key="loading"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
        >
          {/* Title with breathe pulse */}
          <h1
            className="font-display text-2xl tracking-wide text-text animate-breathe select-none sm:text-3xl"
          >
            elastic mindfulness
          </h1>

          {/* Progress bar */}
          <div className="mt-8 w-48 sm:w-64">
            <div className="relative h-px w-full overflow-hidden bg-muted/20">
              <div
                className="absolute inset-y-0 left-0 bg-accent"
                style={{
                  width: `${progress * 100}%`,
                  boxShadow: "0 0 8px rgba(212, 165, 116, 0.6), 0 0 20px rgba(212, 165, 116, 0.3)",
                }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
