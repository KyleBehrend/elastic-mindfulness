# Deployment Checklist

## Environment Variables (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SITE_URL` | `https://elasticmindfulness.com` | Optional (hardcoded fallback) |

## Domain Setup

1. Point `elasticmindfulness.com` to Vercel:
   - **Option A (Cloudflare DNS):** Add CNAME record: `elasticmindfulness.com` → `cname.vercel-dns.com`
   - **Option B (Vercel nameservers):** Update registrar nameservers to Vercel's NS records
2. Add `www.elasticmindfulness.com` as a redirect domain (handled by `vercel.json`)
3. Verify SSL certificate auto-provisions via Vercel dashboard

## Pre-Launch Testing

- [ ] iPhone Safari (latest iOS)
- [ ] Android Chrome (latest)
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari

## Lighthouse Targets

| Category | Target |
|----------|--------|
| Performance | 90+ |
| Accessibility | 95+ |
| Best Practices | 95+ |
| SEO | 100 |

## Experience Flow Testing

Test the full flow on a real phone (not DevTools emulation):

1. Loading screen → progress bar fills → fades out
2. Intro → strand responds to touch → tap to begin
3. Prompt → keyboard appears → type thought → "let go"
4. Breathe → 5 cycles of inhale/exhale → auto-advance
5. Dissolve → particles explode → mandala reform → "keep going"
6. Canvas → draw strands → symmetry modes → share
7. Share → save image / copy link / native share → start over

## Social Preview Testing

Paste the URL in each platform and verify OG image + description render:

- [ ] iMessage
- [ ] WhatsApp
- [ ] Slack
- [ ] Twitter/X
- [ ] LinkedIn

## Deploy

```bash
# Build locally first
npm run build

# Deploy via Vercel CLI
npx vercel --prod

# Or push to main branch for auto-deploy
git push origin main
```
