# Elastic Mindfulness

An experiential, single-page interactive website that takes visitors through a 60-second mindfulness journey, then unlocks a generative elastic canvas.

## Core design principle
REWARD SLOWNESS. Every interaction produces more beauty when the user moves deliberately. Fast/frantic input produces chaos or nothing. This inverts the logic of every other website.

## Tech stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS with custom warm/dark palette
- React Three Fiber + drei for WebGL scenes
- GSAP + ScrollTrigger for scroll-driven animation
- Lenis for smooth scrolling
- Motion (Framer Motion v12+) for UI micro-interactions
- Tone.js for ambient audio
- @use-gesture/react for touch/mouse gestures

## Key constraints
- Mobile-first (most mindfulness happens on phones)
- Target < 500KB initial JS payload
- Sub-3-second load on 3G
- All R3F components must use 'use client' directive
- Tone.start() requires user gesture before audio plays
- DeviceMotionEvent.requestPermission() required on iOS 13+
- No localStorage usage needed — pure ephemeral experience

## Aesthetic direction
Organic, elastic, luminous. Flowing curves and stretch physics. Dark background with warm gold/amber light. Think bioluminescence in a dark ocean. Never geometric, rigid, or corporate.
