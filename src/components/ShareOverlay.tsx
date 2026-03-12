"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useExperience } from "@/lib/experience-state";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  getLastCapture,
  exportCanvasWithBranding,
} from "@/lib/canvas-export";

export default function ShareOverlay() {
  const { dispatch } = useExperience();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brandedBlob, setBrandedBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const reducedMotion = useReducedMotion();

  // Load the captured canvas image on mount
  useEffect(() => {
    const dataUrl = getLastCapture();
    if (!dataUrl) return;
    setPreviewUrl(dataUrl);

    // Generate the branded version in the background
    (async () => {
      const response = await fetch(dataUrl);
      const rawBlob = await response.blob();
      const branded = await exportCanvasWithBranding(rawBlob);
      setBrandedBlob(branded);
    })();
  }, []);

  const handleSaveImage = useCallback(() => {
    const blob = brandedBlob;
    if (!blob || !downloadRef.current) return;
    const url = URL.createObjectURL(blob);
    downloadRef.current.href = url;
    downloadRef.current.download = "elastic-mindfulness.png";
    downloadRef.current.click();
    URL.revokeObjectURL(url);
  }, [brandedBlob]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText("https://elasticmindfulness.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    if (navigator.share && brandedBlob) {
      const file = new File([brandedBlob], "elastic-mindfulness.png", {
        type: "image/png",
      });

      // Check if the browser can share files
      const canShareFiles = navigator.canShare?.({ files: [file] });

      try {
        if (canShareFiles) {
          await navigator.share({
            title: "I made this with elastic mindfulness",
            url: "https://elasticmindfulness.com",
            files: [file],
          });
        } else {
          // Share without file (URL + title only)
          await navigator.share({
            title: "I made this with elastic mindfulness",
            url: "https://elasticmindfulness.com",
          });
        }
        return;
      } catch {
        // User cancelled or share failed — fall through to copy link
      }
    }
    // Fallback: copy link
    handleCopyLink();
  }, [brandedBlob, handleCopyLink]);

  const panelTransition = reducedMotion
    ? { duration: 0.3 }
    : { type: "spring" as const, damping: 30, stiffness: 300 };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Close button */}
      <motion.button
        className="absolute right-4 top-4 z-10 p-2 font-body text-sm text-text opacity-40 transition-opacity hover:opacity-70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.3 }}
        onClick={() => dispatch({ type: "SET_PHASE", payload: "canvas" })}
        aria-label="Close"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
      </motion.button>

      {/* Share panel — slides up from bottom (or fades for reduced motion) */}
      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 px-6 pb-12 pt-8"
        initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
        animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
        transition={panelTransition}
      >
        {/* Title */}
        <p className="text-glow font-display text-lg text-text opacity-80">
          your elastic creation
        </p>

        {/* Canvas preview */}
        {previewUrl && (
          <motion.div
            className="w-full overflow-hidden rounded-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Your elastic canvas artwork"
              className="w-full"
            />
          </motion.div>
        )}

        {/* Share buttons */}
        <motion.div
          className="flex gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            className="font-body text-sm text-text opacity-60 hover-lift disabled:opacity-30"
            onClick={handleSaveImage}
            disabled={!brandedBlob}
            aria-label="Save image"
          >
            save image
          </button>

          <button
            className="font-body text-sm text-text opacity-60 hover-lift"
            onClick={handleCopyLink}
            aria-label="Copy link"
          >
            {copied ? "copied \u2713" : "copy link"}
          </button>

          <button
            className="font-body text-sm text-text opacity-60 hover-lift disabled:opacity-30"
            onClick={handleShare}
            disabled={!brandedBlob}
            aria-label="Share"
          >
            share
          </button>
        </motion.div>

        {/* Start over */}
        <motion.button
          className="font-body text-xs text-muted opacity-40 hover-lift"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.6 }}
          onClick={() => dispatch({ type: "SET_PHASE", payload: "intro" })}
          aria-label="Start over"
        >
          start over
        </motion.button>
      </motion.div>

      {/* Hidden download anchor */}
      <a ref={downloadRef} className="hidden" />
    </div>
  );
}
