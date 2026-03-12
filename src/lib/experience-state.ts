"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import React from "react";

// ── Phase types ──────────────────────────────────────────────────────
export type ExperiencePhase =
  | "intro"
  | "prompt"
  | "breathe"
  | "dissolve"
  | "canvas"
  | "share";

// ── State shape ──────────────────────────────────────────────────────
export interface ExperienceState {
  phase: ExperiencePhase;
  userThought: string;
  breathCount: number;
  canvasUnlocked: boolean;
  audioEnabled: boolean;
  interactionSpeed: number;
  performanceTier: "high" | "low";
}

const initialState: ExperienceState = {
  phase: "intro",
  userThought: "",
  breathCount: 0,
  canvasUnlocked: false,
  audioEnabled: false,
  interactionSpeed: 0,
  performanceTier: "high",
};

// ── Actions ──────────────────────────────────────────────────────────
export type ExperienceAction =
  | { type: "SET_PHASE"; payload: ExperiencePhase }
  | { type: "SET_THOUGHT"; payload: string }
  | { type: "INCREMENT_BREATH" }
  | { type: "UNLOCK_CANVAS" }
  | { type: "TOGGLE_AUDIO" }
  | { type: "UPDATE_SPEED"; payload: number }
  | { type: "SET_PERFORMANCE_TIER"; payload: "high" | "low" };

function experienceReducer(
  state: ExperienceState,
  action: ExperienceAction
): ExperienceState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.payload };
    case "SET_THOUGHT":
      return { ...state, userThought: action.payload };
    case "INCREMENT_BREATH":
      return { ...state, breathCount: Math.min(state.breathCount + 1, 6) };
    case "UNLOCK_CANVAS":
      return { ...state, canvasUnlocked: true };
    case "TOGGLE_AUDIO":
      return { ...state, audioEnabled: !state.audioEnabled };
    case "UPDATE_SPEED":
      return {
        ...state,
        interactionSpeed: Math.max(0, Math.min(1, action.payload)),
      };
    case "SET_PERFORMANCE_TIER":
      return { ...state, performanceTier: action.payload };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────
const ExperienceContext = createContext<{
  state: ExperienceState;
  dispatch: Dispatch<ExperienceAction>;
} | null>(null);

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(experienceReducer, initialState);

  return React.createElement(
    ExperienceContext.Provider,
    { value: { state, dispatch } },
    children
  );
}

export function useExperience() {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error("useExperience must be used within an ExperienceProvider");
  }
  return context;
}
