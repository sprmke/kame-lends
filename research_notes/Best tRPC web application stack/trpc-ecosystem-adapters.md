# tRPC ecosystem, adapters, T3 stack, and recommended setup (as of 2026)

Research date: 2026-09-21. Prefer official docs, GitHub, and npm registry. Older T3/Next 12–13 guidance is marked historical.

## What is the current tRPC major version (v10 vs v11) and what changed that affects stack choice?

### Takeaway

Current published major is **tRPC v11**. Latest npm `@trpc/server` is **11.19.0** (verified 2026-09-21). New React/Next apps should choose **App Router + fetch adapter + `@trpc/tanstack-react-query`**, not the v10-era Pages Router + `@trpc/next` + `@trpc/react-query` stack, though those remain supported.

### Cited Findings

- Official docs are labeled **Version: 11.x** on adapter pages. — [Next.js Adapter](https://trpc.io/docs/server/adapters/nextjs)
- npm registry latest for `@trpc/server` is **11.19.0**. Package requires `typescript >=5.7.2`. Dev deps include `react ^19.1.0`, `express ^5.0.0`, `next` (catalog), `zod ^4.2.1`. — [registry.npmjs.org/@trpc/server/latest](https://registry.npmjs.org/@trpc/server/latest)
- Web search snippets also listed `@trpc/server` **11.18.0** (updated 2026-06-17). That is **older than 11.19.0** on the registry as of this research date; use 11.19.0. — [npm @trpc/server](https://www.npmjs.com/package/@trpc/server); contradicted (superseded) by [registry latest 11.19.0](https://registry.npmjs.org/@trpc/server/latest)
- Migration guide title: **Migrating from v10 to v11**. Install line is `@trpc/server@^11` plus `@trpc/client`, `@trpc/react-query`, `@trpc/next`, and **`@tanstack/react-query@^5`**. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
- **Breaking / stack-choice changes in v11:**
  - React Query **peer dependency is v5** (`isLoading` → `isPending`). — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
  - **Transformers moved to links** (e.g. `superjson` on the HTTP link, not only on client init). — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
  - **TypeScript >= 5.7.2 required.** — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11); [Quickstart](https://trpc.io/docs/quickstart)
  - **React >= 18.2.0**, **Node.js 18+**, modern browsers; FormData/File/Blob/ReadableStream used. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
  - HTTP internals now use Fetch **`Request`/`Response`** (`resolveHTTPRequest` → `resolveRequest`). Affects custom adapters. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
  - **v9 interop mode removed.** `createTRPCProxyClient` renamed to `createTRPCClient`. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)
- **Non-breaking but stack-relevant v11 features:** new **TanStack React Query integration**; SSE subscriptions (`httpSubscriptionLink`); `httpBatchStreamLink`; HTTP/2 standalone; lazy routers; Fastify adapter requires **Fastify v5+**. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11); [Fastify Adapter](https://trpc.io/docs/server/adapters/fastify)
- Quickstart: “tRPC requires TypeScript >=5.7.2” and strongly recommends `"strict": true`. Zod is the docs’ default validator (Yup/Valibot also shown). — [Quickstart](https://trpc.io/docs/quickstart)

### Inferences

- v10 is historical. New stack choice is driven by: React Query v5, TS 5.7+, Fetch-native HTTP, and the **new `@trpc/tanstack-react-query` package** (not the classic proxy hooks).
- Pinning tRPC at **11.0.0** (as create-t3-app still does) is behind current **11.19.0** and likely misses later TanStack Query peer (`^5.80.3` on the new package).

### Gaps

- Exact 11.19.0 changelog / GitHub release notes were not fetched (GitHub HTML README fetch returned almost no body). Use [github.com/trpc/trpc/releases](https://github.com/trpc/trpc/releases) if a patch-level changelog is needed.
- Whether v12 exists: **no evidence** on docs or npm latest; current major is 11.

## Which official adapters exist, and which are first-class vs community?

### Takeaway

First-party HTTP adapters ship **inside `@trpc/server`**: standalone, node-http, Express, Fastify, Fetch, Next.js Pages (`adapters/next`), AWS Lambda, WebSocket, and experimental Next App Dir caller. App Router / TanStack Start / Remix / Astro / SolidStart / edge runtimes use the **Fetch adapter**, not a separate Next App Router HTTP adapter. Community adapters cover Koa, Bun, uWebSockets, Electron, MQTT, etc.

### Cited Findings

- Docs: tRPC is not a server; adapters glue host ↔ API. Supported modes include **Standalone**, **Express**, **Fastify**, **AWS Lambda**, **Fetch** (edge), **full Next.js integration**, or Fetch with **Next.js, Astro, Remix, or SolidStart**. — [Adapters overview](https://trpc.io/docs/server/adapters)
- Standalone is recommended for local/serverful when there is no existing HTTP server; swapping later is described as trivial. — [Adapters overview](https://trpc.io/docs/server/adapters); [Quickstart](https://trpc.io/docs/quickstart) uses `createHTTPServer` from `@trpc/server/adapters/standalone`
- **`@trpc/server` package exports** (first-party, verified on npm 11.19.0):
  - `./adapters/standalone`
  - `./adapters/node-http`
  - `./adapters/express`
  - `./adapters/fastify`
  - `./adapters/fetch`
  - `./adapters/next` (Pages Router `createNextApiHandler`)
  - `./adapters/aws-lambda`
  - `./adapters/ws`
  - `./adapters/next-app-dir` (typedoc: `experimental_nextAppDirCaller`)
    — [registry.npmjs.org/@trpc/server/latest](https://registry.npmjs.org/@trpc/server/latest); [typedoc modules](https://trpc.io/docs/typedoc/server/)
- **Pages Router HTTP:** `createNextApiHandler` from `@trpc/server/adapters/next` in `pages/api/trpc/[trpc].ts`. — [Next.js Adapter](https://trpc.io/docs/server/adapters/nextjs)
- **App Router HTTP:** docs say use the **fetch adapter**, not the Next adapter, because route handlers use Web `Request`/`Response`. Example: `fetchRequestHandler` in `app/api/trpc/[trpc]/route.ts`, export GET and POST. — [Next.js Adapter](https://trpc.io/docs/server/adapters/nextjs); [App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup)
- **Fetch / WinterCG:** Cloudflare Workers, Deno Deploy, Vercel/Next Edge; also **Astro SSR, Remix, SolidStart**. Required APIs: Request, Response, fetch, Headers, URL. — [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- Fastify v11 adapter **requires Fastify v5+**; Fastify v4 may return empty responses. WebSockets via `@fastify/websocket` (`useWSS`). — [Fastify Adapter](https://trpc.io/docs/server/adapters/fastify)
- Community **library adapters** (not in `@trpc/server`): Koa, Bun, uWebSockets, Electron, Cloudflare Pages plugin, RabbitMQ/MQTT/Redis transports, NestJS-tRPC, vscode-trpc, etc. — [Awesome tRPC](https://trpc.io/docs/community/awesome-trpc)
- Community **frontend framework wrappers**: trpc-sveltekit, trpc-remix, solid-trpc, solid-start-trpc, trpc-nuxt. — [Awesome tRPC](https://trpc.io/docs/community/awesome-trpc)

### Inferences

- “Official adapter” ≈ export under `@trpc/server/adapters/*`.
- Next.js App Router is first-class **as a documented setup**, but the HTTP layer is the **Fetch adapter**. `@trpc/next` is Pages-only.
- `adapters/next-app-dir` is for **Server Actions / RSC caller** (`experimental_nextAppDirCaller`), not the App Router route handler.
- Fetch docs **do not name TanStack Start**; that host is Fetch-compatible by construction (see T3 Turbo). SolidStart is named.

### Gaps

- AWS Lambda and WebSocket adapter pages were not fully fetched; existence is confirmed via package exports and adapters overview.
- No official “community vs first-party” badge table; classification above is from package exports vs awesome-trpc.

## What is create-t3-app / T3 stack in 2025–2026: defaults for Next.js, tRPC, Prisma vs Drizzle, Auth.js, Tailwind, TanStack Query?

### Takeaway

T3 remains a **modular Next.js + TypeScript** CLI (`create-t3-app` **7.40.0**), not a framework. Template deps: **Next.js ^15.5.9**, **React 19**, **tRPC 11.0.0**, **TanStack Query ^5.69.0**, **Tailwind CSS v4**, Prisma **and** Drizzle optional, **NextAuth v4** still the `--default` auth, **Better Auth** now a first-class CLI option. Interactive App Router prompt defaults to **yes**; `--default` still has `appRouter: false`. T3 still scaffolds **classic `@trpc/react-query` + `@trpc/next`**, not `@trpc/tanstack-react-query`.

### Cited Findings

- T3 Stack: “web development stack made by Theo focused on simplicity, modularity, and full-stack typesafety.” Core: **Next.js + TypeScript**. Tailwind “almost always included.” Backend extras: **tRPC, Prisma, NextAuth.js**. — [create.t3.gg introduction](https://create.t3.gg/en/introduction)
- CLI homepage packages listed: Next.js, Prisma, TypeScript, Tailwind, tRPC, NextAuth.js. Drizzle is documented separately as an ORM option. — [create.t3.gg](https://create.t3.gg/); [Drizzle usage](https://create.t3.gg/en/usage/drizzle)
- CLI version **7.40.0**. Template/devDependencies on that commit:
  - `next`: **^15.5.9**
  - `react` / `react-dom`: **^19.2.3**
  - `@trpc/client|next|react-query|server`: **11.0.0** (exact)
  - `@tanstack/react-query`: **^5.69.0**
  - `tailwindcss` / `@tailwindcss/postcss`: **^4.0.15**
  - `prisma` / `@prisma/client`: **^6.6.0**
  - `drizzle-orm`: **^0.41.0**, `drizzle-kit`: **^0.30.5**
  - `next-auth`: **^4.24.7**
  - `@auth/prisma-adapter`: **^1.6.0**, `@auth/drizzle-adapter`: **^1.1.0**
  - `better-auth`: **^1.3**
  - `superjson`: **^2.2.1**, `zod`: **^3.24.2**
    — [cli/package.json](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/package.json)
- **`--default` / `-y` packages:** `["nextAuth", "prisma", "tailwind", "trpc", "eslint"]`. Flags: `appRouter: false`, `dbProvider: "sqlite"`. — [cli/src/cli/index.ts](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/src/cli/index.ts)
- Interactive prompts (current CLI source):
  - Tailwind: confirm
  - tRPC: confirm
  - Auth: **None | NextAuth.js | BetterAuth** (`initialValue: "none"`)
  - ORM: **None | Prisma | Drizzle** (`initialValue: "none"`)
  - **App Router: confirm with `initialValue: true`**
  - DB provider if ORM chosen: sqlite (LibSQL), mysql, postgres, planetscale
  - Linter: ESLint/Prettier (default) or Biome
  - Prisma + Drizzle incompatible; NextAuth + BetterAuth incompatible
    — [cli/src/cli/index.ts](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/src/cli/index.ts)
- CI flags include `--trpc`, `--prisma`, `--drizzle`, `--nextAuth`, `--betterAuth`, `--tailwind`, `--appRouter`, `--dbProvider`. Default dbProvider if omitted: sqlite. — [Installation](https://create.t3.gg/en/installation); [cli/src/cli/index.ts](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/src/cli/index.ts)
- T3 tRPC usage docs still describe **Pages** layout: `pages/api/trpc/[trpc].ts` with `createNextApiHandler`, `utils/api.ts` React Query hooks (`api.users.getById.useQuery`), SuperJSON, `httpBatchLink` + `loggerLink`. Example routers use `ctx.prisma`. — [create.t3.gg tRPC](https://create.t3.gg/en/usage/trpc)
- Drizzle docs: client at `src/server/db/index.ts`; put `db` on tRPC context; Auth.js Drizzle adapter schema generated when NextAuth + Drizzle selected. — [Drizzle usage](https://create.t3.gg/en/usage/drizzle)
- FAQ still frames App Router as optional and “mature enough”; wording still mentions **Next.js 13 `/app` vs `/pages`**. That is **stale copy** relative to CLI Next 15 + interactive App Router default true. — [FAQ](https://create.t3.gg/en/faq)
- Historical: Next 12/13 Pages-first T3 tutorials remain linked (Twitter clone, blog, chat). FAQ marks some articles as possibly outdated; recommended video is “From 0 to Production” **updated 2024** (RSC, Next, shadcn, Drizzle). — [FAQ](https://create.t3.gg/en/faq)
- Axioms: not an all-inclusive template; will not add Zustand/Redux; **will** add NextAuth and integrate Prisma + tRPC. — [Introduction](https://create.t3.gg/en/introduction)

### Inferences

- **Official T3 “batteries” in 2026:** Next 15 + React 19 + Tailwind 4 + tRPC v11 (classic React Query integration) + TanStack Query v5 + Zod + SuperJSON. ORM and auth are optional; **legacy `--default` is still Prisma + NextAuth v4 + Pages (`appRouter: false`)**.
- **Interactive new-app path** is closer to App Router + choose Drizzle + Better Auth.
- T3 has **not** switched generated tRPC client to `@trpc/tanstack-react-query`, which tRPC itself now recommends for new Next App Router apps. Stack lag vs trpc.io.
- NextAuth in T3 is still **next-auth v4**, with Auth.js adapters (`@auth/*-adapter`) for Prisma/Drizzle. That is not Auth.js v5 as the primary package.

### Gaps

- Generated App Router template’s exact tRPC files (whether it still uses `@trpc/react-query` hooks vs tanstack package) were not read from `cli/template/`. CLI package.json includes `@trpc/next` and `@trpc/react-query`, **not** `@trpc/tanstack-react-query`.
- create.t3.gg “other recommendations” page was not fetched.
- Whether published npm `create-t3-app@latest` equals git `7.40.0` was not separately queried on the registry (source is GitHub `main`).

## What is create-t3-turbo / T3 Turbo status vs create-t3-app?

### Takeaway

**create-t3-turbo is the maintained T3 monorepo starter** (Turborepo + Expo + shared tRPC API). In 2026 it is **more current than create-t3-app’s `--default`**: tRPC **v11**, Drizzle, **better-auth**, Next 15 / optional **TanStack Start v1 rc**, Expo SDK 54, React 19, Tailwind v4. It is a GitHub template (`npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo`), not the same CLI as `npm create t3-app`. Listed as an official starting point on tRPC awesome page.

### Cited Findings

- README (main): “create-t3-turbo now includes the option to use **Tanstack Start** for the web app!” Init: GitHub template or `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo`. — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)
- Apps:
  - **expo:** Expo SDK **54**, RN **0.81**, React **19**, Expo Router, Tailwind v4 / NativeWind v5, tRPC client
  - **nextjs:** Next.js **15**, React **19**, Tailwind v4, typesafe API
  - **tanstack-start:** TanStack Start **v1 (rc)**, React 19, Tailwind v4, typesafe API
    — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)
- Packages: `api` = **tRPC v11** router; `auth` = **better-auth**; `db` = **Drizzle & Supabase** (edge / Vercel Postgres driver); `ui` = shadcn-ui start. — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)
- Purpose: “migrate your T3 application into a monorepo”; stack “originates from create-t3-app”. Expo is “a bonus example”, not Solito. API package is a prod dep only on the web server app; other apps take it as **devDependency** for types. — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)
- tRPC awesome bootstrappers/starting points list **create-t3-app** and **create-t3-turbo**. — [Awesome tRPC](https://trpc.io/docs/community/awesome-trpc)
- Repo metadata at fetch time: ~6,111 stars. — [github.com/t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)

### Inferences

- For **new** T3-flavored apps in 2026: Turbo is the closer match to tRPC maintainers’ App Router / Fetch / modern auth direction, especially if you need Expo or TanStack Start.
- create-t3-app remains the **single-app Next CLI**; Turbo is **monorepo template**. They coexist; Turbo is not a replacement CLI.

### Gaps

- Exact package versions inside Turbo `apps/nextjs/package.json` / `packages/api` were not fetched (README claims tRPC v11 / Next 15 / Start v1 rc).
- Maintenance cadence vs create-t3-app (last commit dates) not verified.

## How does tRPC work with React Server Components, Next.js App Router, and server actions? Known limitations?

### Takeaway

Official new-Next path: **App Router + `fetchRequestHandler` + `@trpc/tanstack-react-query`**. Prefetch in RSCs, consume with React Query in client components. Direct `createCaller` in RSCs **does not hydrate** the Query cache. Server Actions via **`experimental_nextAppDirCaller`** are experimental and **not a replacement** for `useMutation`. tRPC maintainers explicitly say **RSC already solves many tRPC problems; you may not need tRPC**.

### Cited Findings

- Next.js integration: first-class **App Router and Pages Router**. New projects: App Router. — [Next.js Integration](https://trpc.io/docs/client/nextjs)
- App vs Pages comparison from official docs:

  |                 | App Router                                    | Pages Router                                     |
  | --------------- | --------------------------------------------- | ------------------------------------------------ |
  | Recommended for | New projects                                  | Existing Pages projects                          |
  | Data fetching   | Server Components, prefetch                   | `getServerSideProps` / `getStaticProps`, HOC SSR |
  | Server adapter  | Fetch                                         | Next.js adapter                                  |
  | Client package  | `@trpc/tanstack-react-query`                  | `@trpc/next` + `@trpc/react-query`               |
  | Provider        | Manual `QueryClientProvider` + `TRPCProvider` | `withTRPC()` HOC                                 |

  — [Next.js Integration](https://trpc.io/docs/client/nextjs)

- App Router install: `@trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query zod client-only server-only`. Route handler uses Fetch adapter. — [App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup)
- RSC overview: “RSC on its own solves a lot of the same problems tRPC was designed to solve, so **you may not need tRPC at all**.” Integration is “not one-size-fits-all.” Read TanStack Query **Advanced Server Rendering** first. — [RSC + tanstack-react-query](https://trpc.io/docs/client/tanstack-react-query/server-components)
- **Hooks only in Client Components.** Prefetch in a Server Component (`prefetchQuery` / helpers), hydrate with `HydrationBoundary`. Fire-and-forget prefetch streams; `await` prefetch waits (slower TTFB, data ready on first client render). — [App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup); [RSC guide](https://trpc.io/docs/client/tanstack-react-query/server-components)
- **Limitation:** `createCaller` / invoking procedures in an RSC is **detached from QueryClient**; data is **not** in the client cache. Intentional; see RQ Advanced Server Rendering. Use `fetchQuery` only if you accept those tradeoffs for dual server+client use. — [App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup)
- QueryClient: per-request on server (`React.cache` / `cache(makeQueryClient)`); browser singleton so React suspend does not recreate client. Default `staleTime` > 0 to avoid immediate refetch. Dehydrate **pending** queries to stream promises. — [App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup)
- Classic RSC helpers still exist at `@trpc/react-query/rsc` (`createHydrationHelpers`) for the old integration. — [Set up with React Server Components (classic)](https://trpc.io/docs/client/react/server-components)
- **Server Actions:** `experimental_caller` + `experimental_nextAppDirCaller` from `@trpc/server/adapters/next-app-dir`. “**experimental\_ prefix**… API may change.” No HTTP `createContext`; inject session via **middleware**. Actions are plain async functions (`"use server"`). — [Server Actions](https://trpc.io/docs/client/nextjs/server-actions)
- Official tradeoff table:
  - **Server Actions:** progressive enhancement (forms without JS); when you **do not** need React Query cache updates.
  - **`useMutation`:** cache updates, optimistic updates, complex loading/error UI.
  - Incremental adoption; do not rewrite the whole API.
    — [Server Actions](https://trpc.io/docs/client/nextjs/server-actions)

### Inferences

- tRPC on App Router is a **prefetch + client React Query** pattern, not “call tRPC hooks in RSCs.”
- Server Actions are a **parallel experimental path**, not the default mutation story.
- For RSC-only apps, maintainers’ own docs weaken the case for tRPC; tRPC still wins for **shared typed API** (Expo, other clients, non-RSC mutations, subscriptions).

### Gaps

- URL `https://trpc.io/docs/client/nextjs/server-components` **404** (redirected conceptually to tanstack-react-query + app-router-setup).
- `https://trpc.io/docs/server/adapters/next-app-dir` **404**; typedoc function page exists. Docs live under Server Actions, not a full adapter guide.
- No official benchmark of tRPC vs raw Server Actions vs `fetch` in RSC.

## What client libraries exist (React Query, Vue, Solid, Svelte, vanilla)? Which are first-class?

### Takeaway

First-party clients: **vanilla `@trpc/client`**, **classic `@trpc/react-query`**, **new `@trpc/tanstack-react-query` (recommended)**, **`@trpc/next` (Pages)**. Vue, Solid, Svelte, Nuxt, Remix wrappers are **community**. Vanilla works anywhere JS runs; framework integrations are optional.

### Cited Findings

- Docs intro: backend adapters for many frameworks; frontend: **TanStack React Query or Next.js**, **third-party** for other frameworks, or **Vanilla Client**. — [tRPC docs intro](https://trpc.io/docs)
- Quickstart next steps: **TanStack React Query** “Recommended React integration via `@trpc/tanstack-react-query`”; Next.js; Server Adapters; Transformers. — [Quickstart](https://trpc.io/docs/quickstart)
- Vanilla: `@trpc/client` + type-only `AppRouter`; `createTRPCClient` + terminating link (e.g. `httpBatchLink`). — [Vanilla setup](https://trpc.io/docs/client/vanilla/setup)
- Classic React Query package **still supported** but **not recommended for new projects**. First-class React integration historically wrapped `@tanstack/react-query`. Optional: can use vanilla client + RQ with manual keys. If using Next, prefer Next integration (Pages). — [Classic React Query](https://trpc.io/docs/client/react)
- New package `@trpc/tanstack-react-query` **11.19.0**; homepage `https://trpc.io/docs/client/tanstack-react-query/setup`; peers: `react >=18.2.0`, `@trpc/client`/`@trpc/server` **11.19.0**, `@tanstack/react-query ^5.80.3`. Factories: QueryKeys, QueryOptions, MutationOptions; `useQuery(trpc.x.queryOptions())`. — [registry @trpc/tanstack-react-query](https://registry.npmjs.org/@trpc/tanstack-react-query/latest); [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Community frontend (awesome-trpc): **tRPC-SvelteKit**, **tRPC-Remix**, **solid-trpc**, **solid-start-trpc**, **tRPC-nuxt**. — [Awesome tRPC](https://trpc.io/docs/community/awesome-trpc)
- Additional community Query wrappers (not on awesome table as first-party): `@falcondev-oss/trpc-vue-query`, `trpc-svelte-query-adapter`. — [trpc-vue-query](https://github.com/falcondev-oss/trpc-vue-query); [trpc-svelte-query-adapter](https://github.com/vishalbalaji/trpc-svelte-query-adapter/)
- GitHub PR **#6742** proposes first-party `@trpc/tanstack-solid-query`. **Not verified as published on npm** in this research. — [PR 6742](https://github.com/trpc/trpc/pull/6742)

### Inferences

- “First-class” in 2026 = packages under the **`@trpc/*` npm org** maintained in trpc/trpc: server, client, tanstack-react-query, react-query, next.
- Vue/Svelte/Solid DX comparable to React only via community; vanilla client is the official escape hatch.

### Gaps

- Whether `@trpc/tanstack-solid-query` shipped in 11.19.0 was not checked on npm.
- No official Vue/Svelte package under `@trpc/*`.

## What is the current relationship between tRPC, TanStack Query, and TanStack Start?

### Takeaway

tRPC’s recommended React client **is** TanStack Query: new apps should use `@trpc/tanstack-react-query` (Query-native `queryOptions`/`mutationOptions`) rather than tRPC-flavored `useQuery` proxies. TanStack Start is **not** a first-party tRPC adapter name; hosts that speak Fetch (including T3 Turbo’s Start app) use **`adapters/fetch`**. tRPC docs now push **TanStack Intent** skills (`npx @tanstack/intent@latest install`) on many pages.

### Cited Findings

- New integration “more TanStack Query-native”; “we think it’s the future and recommend using this over the classic client.” — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Usage: `useQuery(trpc.getUser.queryOptions({ id }))` and `useMutation(trpc.createUser.mutationOptions())` from `@tanstack/react-query`. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Integration is optional; vanilla client + manual RQ keys works. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup); [Classic React Query](https://trpc.io/docs/client/react)
- Fetch adapter lists SolidStart, Remix, Astro, Next Edge; **does not list TanStack Start**. — [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- create-t3-turbo ships `apps/tanstack-start` with “E2E Typesafe API Server & Client” alongside Next.js, sharing `packages/api` tRPC v11. — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)
- Multiple tRPC docs pages: “If you use an AI coding agent, install tRPC skills… `npx @tanstack/intent@latest install`”. `@trpc/server` keywords include `tanstack-intent`; has bin `intent`. — [Quickstart](https://trpc.io/docs/quickstart); [registry @trpc/server](https://registry.npmjs.org/@trpc/server/latest)
- v11 migration: “New TanStack React Query integration! (non-breaking)” with pointer to a blog post. — [Migrate from v10 to v11](https://trpc.io/docs/migrate-from-v10-to-v11)

### Inferences

- Organizationally tRPC is aligning DX with **TanStack** (Query API shape, Intent, Start as a T3 Turbo option), while remaining framework-agnostic on the server (Fetch adapter).
- For a Start app, treat tRPC like any Fetch host: `fetchRequestHandler` on a server route + `@trpc/tanstack-react-query` on the client.

### Gaps

- No trpc.io page titled “TanStack Start adapter.” Official Start+tRPC setup is implied, not spelled out (T3 Turbo is the practical reference).
- TanStack Query docs’ own tRPC page was not fetched (assignment suggested it); tRPC-side docs were used.

## Any official “recommended stack” pages from trpc.io, T3 docs, or Theo/T3 maintainers?

### Takeaway

tRPC does **not** prescribe Prisma/Auth/Tailwind. It recommends **TypeScript strict, Zod in examples, standalone or host adapter, and `@trpc/tanstack-react-query` for new React; App Router + Fetch for new Next.js**. T3 docs prescribe a **modular Next stack** and list create-t3-app as a bootstrapper. Theo/T3 FAQ still carries **Next 13-era App vs Pages** language. create-t3-turbo README is the most up-to-date **full-stack T3 opinion** (Drizzle, better-auth, Start or Next 15, Expo).

### Cited Findings

- **trpc.io Creating a new project:** choose backend adapter + frontend integration (TanStack React Query, Next.js, third-party, or vanilla); scaffold from a template or docs. No single ORM/auth. — [Docs intro](https://trpc.io/docs)
- **trpc.io Next.js:** “If you’re starting a new project, we recommend the App Router.” Pages fully supported. — [Next.js Integration](https://trpc.io/docs/client/nextjs)
- **trpc.io React:** new TanStack integration over classic. — [TanStack React Query](https://trpc.io/docs/client/tanstack-react-query); [Classic (not recommended for new)](https://trpc.io/docs/client/react)
- **trpc.io adapters:** standalone simplest for greenfield serverful. — [Adapters overview](https://trpc.io/docs/server/adapters)
- **trpc.io examples / bootstrappers:** create-t3-app, create-t3-turbo, recommended Prisma+Next starter `trpc/examples-next-prisma-starter`. — [Awesome tRPC](https://trpc.io/docs/community/awesome-trpc)
- **T3:** `npm create t3-app@latest`; modular; Next + TS core; optional tRPC/Prisma/NextAuth/Tailwind/Drizzle. “This is NOT an all-inclusive template.” — [create.t3.gg](https://create.t3.gg/); [Introduction](https://create.t3.gg/en/introduction)
- **T3 FAQ learning:** community and Theo recommend building rather than courses; listed videos include outdated Pages+Prisma T3 clones; recommended production tutorial is **2024** RSC/Drizzle. App Router FAQ still says “Next.js 13.” — [FAQ](https://create.t3.gg/en/faq)
- **T3 Turbo** encodes a newer default: Drizzle, better-auth, tRPC v11, Next 15 **or** TanStack Start, Expo. — [create-t3-turbo README](https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/README.md)

### Inferences

- Closest thing to an official 2026 “recommended web app stack” from **tRPC maintainers:** TypeScript 5.7+ strict, Zod, `@trpc/server` 11.x, Fetch or standalone adapter, **`@trpc/tanstack-react-query` + TanStack Query v5**, Next.js **App Router** if using Next.
- Closest **T3-maintainer** full stack for new work: **create-t3-turbo** (or interactive create-t3-app with App Router + Drizzle + Better Auth), **not** `create-t3-app -y` (Prisma + NextAuth v4 + Pages).
- Do not treat 2022–2024 “T3 = Next 13 Pages + Prisma + NextAuth + `@trpc/react-query`” posts as current.

### Gaps

- Theo/T3 tweets or 2025–2026 blog posts were not used (constraint: prefer official docs).
- tRPC blog post announcing the new TanStack integration was linked from the migration guide but not fetched.
- `https://create.t3.gg/en/other-recs` not fetched.

## Version snapshot (verified 2026-09-21)

| Package                                             | Version                                       | Source                                                                                                         |
| --------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@trpc/server`                                      | **11.19.0**                                   | [npm registry latest](https://registry.npmjs.org/@trpc/server/latest)                                          |
| `@trpc/tanstack-react-query`                        | **11.19.0** (peers RQ **^5.80.3**)            | [npm registry latest](https://registry.npmjs.org/@trpc/tanstack-react-query/latest)                            |
| `@trpc/client` / `@trpc/react-query` / `@trpc/next` | same major line as server; T3 pins **11.0.0** | [create-t3-app cli/package.json](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/package.json) |
| `create-t3-app` CLI                                 | **7.40.0**                                    | [cli/package.json](https://raw.githubusercontent.com/t3-oss/create-t3-app/main/cli/package.json)               |
| T3 template Next                                    | **^15.5.9**                                   | same                                                                                                           |
| T3 template TanStack Query                          | **^5.69.0**                                   | same                                                                                                           |
| TypeScript (tRPC requirement)                       | **>= 5.7.2**                                  | [Quickstart](https://trpc.io/docs/quickstart)                                                                  |

## First-party `@trpc/server` adapters (11.19.0 exports)

| Adapter      | Import                  | Typical host                                         | Class                           |
| ------------ | ----------------------- | ---------------------------------------------------- | ------------------------------- |
| Standalone   | `adapters/standalone`   | Node HTTP/1, HTTP/2                                  | First-party; quickstart default |
| Node HTTP    | `adapters/node-http`    | raw Node                                             | First-party                     |
| Express      | `adapters/express`      | Express 5 in current server devDeps                  | First-party                     |
| Fastify      | `adapters/fastify`      | Fastify **v5+**                                      | First-party                     |
| Fetch        | `adapters/fetch`        | App Router, Edge, Remix, Astro, SolidStart, WinterCG | First-party; App Router HTTP    |
| Next Pages   | `adapters/next`         | `pages/api`                                          | First-party                     |
| AWS Lambda   | `adapters/aws-lambda`   | API Gateway / Lambda                                 | First-party                     |
| WebSocket    | `adapters/ws`           | ws servers                                           | First-party                     |
| Next App Dir | `adapters/next-app-dir` | Server Actions caller                                | First-party **experimental**    |

Community adapters: see [Awesome tRPC library adapters](https://trpc.io/docs/community/awesome-trpc).
