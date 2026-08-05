<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PIC Checkin

Club check-in/member/payment management app. Next.js 16 App Router + Notion API (`@notionhq/client`) as the backing store — no traditional database.

## Key files
- `lib/notionStore.ts` — Notion reads/writes; property maps: `memberProperties`, `checkinProperties`, `paymentProperties`
- `lib/adminStore.ts` — admin data access
- `lib/auth.ts` / `lib/authToken.ts` — auth; session tokens use Web Crypto (`authToken.ts`) so they work on both Edge and Node
- `lib/loginRateLimit.ts` — login rate limiting
- `proxy.ts` — middleware, runs on the **Edge runtime** — do not import Node-only APIs (e.g. `node:crypto`) here; reuse `lib/authToken.ts` for session logic instead
- `app/api/**/route.ts` — API routes

## Conventions
- Protect admin API routes with `requireRole(["admin"])` (see `lib/auth.ts`).
- User-facing error messages are in Korean.
- Compare passwords/secrets with the timing-safe `safeCompare` pattern in `lib/auth.ts` (`timingSafeEqual`-based) — never plain `===`.
- When querying Notion, don't drop the pagination `cursor` loop if results can exceed one page.
- UI: inline `CSSProperties` style objects (see `app/scan/page.tsx`, `app/checkins/page.tsx`, `app/admin/participants/page.tsx`), with Tailwind used alongside in `app/globals.css`. Follow this existing pattern rather than introducing a new styling approach.
- i18n: split copy as `{ ko: {...}, en: {...} }` and read it via `pick(language, copy)` from `app/useLanguage.ts`.

## Commands
```bash
npm run lint              # eslint
./node_modules/.bin/tsc --noEmit   # typecheck
npm test                  # node --test
```

## Notion QA data
When testing writes against the real Notion database, name dummy records with "QA"/"테스트" and clean them up afterward via the Notion API (`archived: true`). Ask the user before any operation that touches production data.
