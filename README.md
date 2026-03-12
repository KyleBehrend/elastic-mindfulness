# Elastic Mindfulness

A 60-second interactive mindfulness experience that rewards being slow. Stretch elastic light, breathe, let go, and create shareable generative art.

<!-- ![Elastic Mindfulness screenshot](screenshot.png) -->

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **3D:** React Three Fiber + drei + postprocessing
- **Animation:** Motion (Framer Motion v12), GSAP
- **Audio:** Tone.js (ambient drone, breath sync, pluck synth)
- **Gestures:** @use-gesture/react
- **Styling:** Tailwind CSS
- **Analytics:** Vercel Analytics

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run analyze` | Build with bundle analyzer |

## Deployment

Auto-deploys from `main` branch via [Vercel](https://vercel.com). See [DEPLOYMENT.md](DEPLOYMENT.md) for the full checklist.

## Credits

Built with [Claude Code](https://claude.ai/claude-code) as a creative showcase.

## Licence

MIT
