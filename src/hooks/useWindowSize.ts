"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface WindowSize {
  width: number;
  height: number;
  isLandscape: boolean;
}

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    isLandscape:
      typeof window !== "undefined"
        ? window.innerWidth > window.innerHeight
        : false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const update = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
        isLandscape: window.innerWidth > window.innerHeight,
      });
    }, 100);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [update]);

  return size;
}
