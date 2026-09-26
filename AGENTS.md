# Prompt Vault — Agent Guide

## 硬性约束：不要为了"验证"读取用户数据

**这个仓库存的全部是 Eray 的私人提示词。** 它们可读，不等于可以随便读。

- **验证功能只能使用元数据**：HTTP 状态码、记录条数、字段名、字符串长度、id 前缀、聚合计数。
  不要把 `title` / `content` / `notes` / `tags` 的真实内容打印到对话、日志或临时文件里。
- **需要查看真实内容时，先征得同意**，并说明要看什么、为什么、看多少。
- **这里有个特别容易踩的坑**：`GET /api/prompts` 是刻意公开、不需要任何密钥的。
  一条 curl 就能把整个库拉走 —— 方便是真方便，**但它不是"可以随手 dump 全库"的许可**。
  用 `?limit=1` + 只看 meta 字段做健康检查就够了。
- **测试写路径时用会被拒绝的非法载荷**（例如缺 `title` 的 body，返回 400 即可证明鉴权与校验都通），
  不要真的插一条测试数据进去。
- 排查导出文件、备份、`.env.local`、数据库 dump 时，一律当作含真实数据对待。
- 读代码以外的文件时优先读结构（`Grep`、只看前几行），而不是整篇读出来。

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |

There is no test runner configured. CI (`.github/workflows/ci.yml`) runs lint → typecheck → build on every push to `main` and on every PR. It supplies placeholder Supabase env vars because `src/lib/supabase.ts` validates them at import time, but CI never touches the database.

## Architecture

Next.js 14 App Router, single-page prompt manager backed by Supabase. Chinese (zh-CN) UI throughout.

```
src/
  middleware.ts         ← 全站登录拦截 + 会话滑动续期（Edge runtime）
  app/
    page.tsx            ← Server Component: fetches all prompts, passes to <PromptVault>
    login/page.tsx      ← 登录页（middleware 明确放行）
    error.tsx           ← 错误边界（客户端组件）
    loading.tsx         ← 加载骨架
    robots.ts           ← 全站 Disallow
    api/prompts/route.ts  ← REST API (GET public, POST bearer-only; Edge runtime)
    api-docs/page.tsx   ← Self-hosted API documentation page
    layout.tsx          ← Root layout, Google Fonts, noindex metadata
    globals.css         ← All theme tokens as CSS variables
  components/           ← Client components only (PromptVault is the root client shell)
  lib/
    auth.ts             ← 会话令牌生成/校验；纯 Web Crypto，Edge 安全，无 Node 依赖
    session.ts          ← getSession / requireSession（写操作守卫）
    auth-actions.ts     ← 登录 / 登出 Server Actions
    prompts.ts          ← 输入校验（parseNewPrompt）+ 排序，UI 与 API 共用
    actions.ts          ← CRUD Server Actions ("use server")
    supabase.ts         ← Supabase client singleton, server-side only
    types.ts            ← Prompt types, category constants, color map, limits
```

### Three auth surfaces — don't mix them up

| Surface | Auth |
|---------|------|
| Web UI (`/`, `/api-docs`) | Password → signed session cookie. Enforced in `middleware.ts` **and** re-checked by `requireSession()` inside every Server Action. |
| `GET /api/prompts` | **None, by design.** Cloud agents must be able to read without a key. Public readability is an accepted trade-off. |
| `POST /api/prompts` | `Authorization: Bearer <API_SECRET>`, always. If `API_SECRET` is unset the route returns **503**, never an unauthenticated write. |

Key constraints when touching auth:

- `src/lib/auth.ts` must stay free of `next/headers` and Node built-ins — middleware imports it and runs on the Edge.
- Browsers cap cookie expiry at 400 days, so "permanent login" is a 400-day cookie plus sliding renewal (`RENEW_AFTER_MS`). Don't try to raise `maxAge` beyond 400 days; it gets silently truncated.
- When `APP_PASSWORD` is missing the site **fails closed**: nobody can log in. That is intentional — never "fall back" to allowing anonymous access.

### Two data paths — don't mix them up

- **Server Actions** (`src/lib/actions.ts`): called by React client components. All web UI mutations go through here. Every one calls `requireSession()`.
- **REST API** (`src/app/api/prompts/route.ts`): external integrations. GET returns favorites first (capped at `MAX_FAVORITES_RETURNED`), then non-favorites paginated (default limit 10, max 100).

**Server Actions return `ActionResult<T>`, they do not throw.** Next.js replaces thrown Server Action error messages with a generic string in production builds, so a returned `{ ok: false, error }` is the only reliable way to surface a message in the UI. `requireSession()` signals auth failure with `redirect("/login")` — redirects are implemented as thrown errors marked `NEXT_REDIRECT`, so client callers must swallow those (see `isRedirectError` in `PromptVault.tsx`).

### Query rules for the API route

- **Paginate and search in SQL, never in memory.** PostgREST returns at most 1000 rows per request and truncates silently; slicing in the Edge function looks like it works right up until the data grows past that limit and results start disappearing without an error.
- **Don't hand-escape values into `or=(...)`.** `sanitizeSearchTerm` strips the structural characters (`,`, `(`, `)`, `{`, `}`, `"`, `\`, `%`, `_`) rather than escaping them, then wraps the remainder in double quotes. Stripping beats nesting escapes — LIKE has its own backslash layer, and doubling the two together is where bugs live.

### Page rendering

`src/app/page.tsx` uses `export const dynamic = "force-dynamic"` — every request fetches fresh data. Don't add caching without understanding this choice.

`PromptVault` keeps local state for optimistic updates and re-syncs from `initialPrompts` via `useEffect`. It also calls `router.refresh()` on window focus (throttled) so another device's edits actually show up. If you add a mutation, call `router.refresh()` after it for the same reason.

## Environment

Required in `.env.local` (copy from `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
APP_PASSWORD=<password for the web UI>
```

Optional:
```
AUTH_SECRET=<random string>          # 会话签名密钥；不设则回退用 APP_PASSWORD
API_SECRET=<secret>                  # POST /api/prompts 的 Bearer 密钥；不设则写接口 503
SUPABASE_SERVICE_ROLE_KEY=<key>      # 服务端改用该 key，便于配合 RLS 加固
```

The Supabase client throws at import time if the two `NEXT_PUBLIC_` vars are missing — `npm run build` will fail without them.

Never commit any of these. The repository is **public**.

## Database

Single `prompts` table. The schema is in `README.md` — there are no migration files.

Categories are an enum constraint in the DB, but in code the single source of truth is `VALID_CATEGORIES` in `src/lib/types.ts` (re-exported through `isValidCategory`, consumed by the API route, the Server Actions and the type guard). Adding a category means updating **two** places: the check constraint in Supabase and `VALID_CATEGORIES`.

`updated_at` is set by the app as a fallback; README documents the `set_updated_at` trigger that makes the database clock authoritative. Prefer the trigger.

## Not indexable

Three independent opt-outs are in place because any single one can be ignored:

1. `src/app/robots.ts` → `Disallow: /`
2. `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` — set globally in `next.config.mjs` **and** explicitly on every `/api/prompts` response
3. `metadata.robots` in `layout.tsx`, `login/page.tsx` and `api-docs/page.tsx`

If you add a route, it inherits (2) from `next.config.mjs`. Don't remove these.

## Theming

All colors, shadows, and fonts are CSS custom properties in `globals.css`. Tailwind config extends with `bg-*`, `border-*`, `text-*`, `accent-*`, `cat-*`, `fav-*` tokens that reference these variables. When adding UI, use the Tailwind token names (e.g. `bg-bg-surface`, `text-text-secondary`) — don't hardcode hex values or use arbitrary values.

Category neon accent colors live **only** in `CATEGORY_COLORS` (`src/lib/types.ts`). The old `--cat-*` CSS vars and the `cat.*` Tailwind mapping were removed — don't reintroduce a second source of truth.

**Neon carries information, not decoration.** Category color belongs only where it identifies something: the card top bar, the category badge, the sidebar indicator, the modal's top strip (which shows the category being edited). Don't add glows to containers, and don't add full-bleed multi-color gradients. Button glows go through the shared `.glow-accent` class; tune them via `--accent-glow-soft` / `--accent-glow` in `globals.css`, never with inline arbitrary values.

`--text-muted` is tuned to clear WCAG AA (≈4.9:1 on the base background). Don't darken it without rechecking contrast.

Animations defined in **both** `globals.css` and `tailwind.config.ts` under the same name will silently override each other. `card-enter` and `flash-copy` live only in `globals.css` — keep it that way.

## Accessibility & layout expectations

- Every form control needs a real `<label htmlFor>` / `id` pair. Placeholder text is not a label.
- Icon-only buttons need `aria-label` (not `title`).
- Anything rendered as an overlay must use `useFocusTrap` (`components/useFocusTrap.ts`) plus `role="dialog"` / `aria-modal`.
- New animations must survive `prefers-reduced-motion` — `globals.css` neutralises durations globally, so don't rely on animation for meaning.
- The app shell is `h-[100dvh]` with the sidebar as a drawer below `lg`. Keep new layout work responsive; there is no separate mobile route.

## Style notes

- UI text and user-facing strings are in Chinese — match existing conventions.
- The `.glass` and `.glass-strong` utility classes provide the frosted-glass effect used on overlays.
- The `.film-grain::after` pseudo-element on `<body>` adds a subtle noise texture over everything — it has `pointer-events: none` and `z-index: 9999`. Its background is an inline `data:` SVG, which is why the CSP allows `img-src data:`.
- Destructive actions use a delayed-commit + Undo toast (`UNDO_WINDOW_MS` in `PromptVault.tsx`) rather than `window.confirm`. Keep that pattern — it also avoids needing a `deleted_at` column.
