"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useExperience } from "@/lib/experience-state";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const MAX_CHARS = 100;

interface Ripple {
  id: number;
  x: number;
  y: number;
}

let rippleId = 0;

export default function ThoughtPrompt() {
  const { dispatch } = useExperience();
  const [thought, setThought] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isLetGo, setIsLetGo] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Show input after 1 second
  useEffect(() => {
    const timer = setTimeout(() => setShowInput(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-focus when input appears
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // ── iOS keyboard fix: shift content when virtual keyboard appears ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardOffset(heightDiff > 50 ? heightDiff * 0.4 : 0);
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Spawn a ripple near the cursor position within the input
  const spawnRipple = useCallback(() => {
    if (reducedMotion) return;

    const wrapper = inputWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const charWidth = 11;
    const cursorX = Math.min(thought.length * charWidth + 4, rect.width - 20);
    const cursorY = rect.height / 2;

    const id = ++rippleId;
    setRipples((prev) => [...prev, { id, x: cursorX, y: cursorY }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 800);
  }, [thought.length, reducedMotion]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_CHARS) {
        setThought(value);
        spawnRipple();
      }
    },
    [spawnRipple]
  );

  const handleLetGo = useCallback(() => {
    if (thought.length < 3 || isLetGo) return;

    setIsLetGo(true);
    dispatch({ type: "SET_THOUGHT", payload: thought });

    setTimeout(() => {
      dispatch({ type: "SET_PHASE", payload: "breathe" });
    }, 500);
  }, [thought, isLetGo, dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleLetGo();
      }
    },
    [handleLetGo]
  );

  const motionTransition = reducedMotion
    ? { duration: 0.01 }
    : { duration: 0.8, ease: "easeOut" as const };

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-transparent px-6"
      style={{
        transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined,
        transition: "transform 0.2s ease-out",
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        {/* Prompt heading */}
        <motion.h2
          className="text-glow font-display text-2xl text-text md:text-4xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition}
        >
          what&apos;s weighing on your mind?
        </motion.h2>

        <motion.p
          className="mt-3 font-body text-sm text-muted"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
          type a thought you&apos;d like to let go of
        </motion.p>

        {/* Text input */}
        {showInput && (
          <motion.div
            className="relative mt-12 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0.01 } : { duration: 0.6, ease: "easeOut" }}
          >
            <div ref={inputWrapperRef} className="relative">
              {/* Ripple container */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <AnimatePresence>
                  {ripples.map((r) => (
                    <motion.span
                      key={r.id}
                      className="absolute rounded-full border border-accent/10"
                      style={{ left: r.x, top: r.y }}
                      initial={{
                        width: 0,
                        height: 0,
                        x: 0,
                        y: 0,
                        opacity: 0.4,
                      }}
                      animate={{
                        width: 60,
                        height: 60,
                        x: -30,
                        y: -30,
                        opacity: 0,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* The thought text — either input or floating away */}
              <AnimatePresence mode="wait">
                {!isLetGo ? (
                  <motion.input
                    key="input"
                    ref={inputRef}
                    type="text"
                    value={thought}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="..."
                    maxLength={MAX_CHARS}
                    className="w-full bg-transparent font-body text-lg text-text caret-accent placeholder:text-muted/40 focus:outline-none md:text-xl"
                    autoComplete="off"
                    spellCheck={false}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    aria-label="Type a thought to let go of"
                  />
                ) : (
                  <motion.p
                    key="floating"
                    className="w-full text-left font-body text-lg text-text md:text-xl"
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: -20, opacity: 0.5 }}
                    transition={reducedMotion ? { duration: 0.01 } : { duration: 0.5, ease: "easeOut" }}
                  >
                    {thought}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Character counter — visible after 10+ characters */}
            <AnimatePresence>
              {thought.length >= 10 && !isLetGo && (
                <motion.span
                  className="absolute -bottom-6 right-0 font-body text-xs text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {thought.length}/{MAX_CHARS}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* "let go →" button — appears after 3+ characters */}
        <AnimatePresence>
          {thought.length >= 3 && !isLetGo && (
            <motion.button
              className="mt-12 animate-breathe font-body text-sm text-accent hover-lift focus:outline-none"
              onClick={handleLetGo}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reducedMotion ? { duration: 0.01 } : { duration: 0.5, ease: "easeOut" }}
              aria-label="Submit thought"
            >
              let go &rarr;
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
