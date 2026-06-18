# Prompt Vault — Agent Guide

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Typecheck | `npm run build` (no separate `typecheck` script; `tsconfig.json` has `noEmit: true`) |

There is no test runner configured. `playwright` is in devDependencies but has no config file — don't assume tests exist.

## Architecture

Next.js 14 App Router, single-page prompt manager backed by Supabase. Chinese (zh-CN) UI throughout.

```
src/
  app/
    page.tsx          ← Server Component: fetches all prompts, passes to <PromptVault>
    api/prompts/route.ts  ← REST API (GET/POST) with optional Bearer auth
    api-docs/page.tsx ← Self-hosted API documentation page
    layout.tsx        ← Root layout, Google Fonts (Bodoni, Work Sans, JetBrains Mono)
    globals.css       ← All theme tokens as CSS variables
  components/         ← Client components only (PromptVault is the root client shell)
  lib/
    actions.ts        ← Server Actions ("use server") for CRUD — used by the web UI
    supabase.ts       ← Supabase client singleton (throws on missing env vars)
    types.ts          ← Prompt types, category constants, color map
```

### Two data paths — don't mix them up

- **Server Actions** (`src/lib/actions.ts`): called by React client components via form actions / direct import. Used for all web UI mutations.
- **REST API** (`src/app/api/prompts/route.ts`): external integrations. POST requires `Authorization: Bearer <API_SECRET>` only if `API_SECRET` env var is set. GET returns favorites first (unlimited), then non-favorites paginated (default limit 20, max 100).

### Page rendering

`src/app/page.tsx` uses `export const dynamic = "force-dynamic"` — every request fetches fresh data. Don't add caching without understanding this choice.

## Environment

Required in `.env.local` (copy from `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Optional:
```
API_SECRET=<secret>   # Protects POST /api/prompts with Bearer auth
```

The Supabase client (`src/lib/supabase.ts`) throws at import time if the two required vars are missing — `npm run build` will fail without them.

## Database

Single `prompts` table. The schema is in `README.md` — there are no migration files. Categories are an enum constraint: `image_generation`, `image_editing`, `video_generation`, `llm_chat`. Don't add new categories without updating the check constraint in Supabase AND `VALID_CATEGORIES` in the API route AND `Category` type in `types.ts`.

## Theming

All colors, shadows, and fonts are CSS custom properties in `globals.css`. Tailwind config extends with `bg-*`, `border-*`, `text-*`, `accent-*`, `cat-*`, `fav-*` tokens that reference these variables. When adding UI, use the Tailwind token names (e.g. `bg-bg-surface`, `text-text-secondary`) — don't hardcode hex values or use arbitrary values.

Category neon accent colors are defined in both `globals.css` (CSS vars) and `types.ts` (`CATEGORY_COLORS`). Keep them in sync.

## Style notes

- UI text and user-facing strings are in Chinese — match existing conventions.
- The `.glass` and `.glass-strong` utility classes provide the frosted-glass effect used on overlays.
- The `.film-grain::after` pseudo-element on `<body>` adds a subtle noise texture over everything — it has `pointer-events: none` and `z-index: 9999`.
