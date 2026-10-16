# Best tRPC web application companion technologies (2026)

Research date: 2026-09-21. Scope is a TypeScript web app whose API layer is tRPC: current best-in-class choices per layer, 2–3 alternatives, tRPC-specific integration quality, plus recommended batteries-included and lean-production stacks.

Maturity labels used below: **official** (tRPC / T3 / vendor docs), **production-scale** (large public apps), **community** (guides/blogs; treat as opinion unless corroborated).

---

## Validation: Zod vs Valibot vs ArkType with tRPC input/output. What does tRPC recommend?

### Takeaway

tRPC’s own docs name **Zod as the default recommendation**. Valibot, ArkType, Effect Schema, Yup, Superstruct, Typia, TypeBox (via wrapper), and any **Standard Schema v1** library work in `.input()` / `.output()` without a tRPC-specific adapter. Pick Zod unless bundle size or a team already on Valibot/ArkType/Effect outweighs ecosystem breadth.

### Cited Findings

- tRPC procedures infer input/output types from validators via the Standard Schema interface when available, or from custom interfaces for libraries tRPC maintains support for. — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- **Zod is tRPC’s default recommendation:** “Zod is our default recommendation, it has a strong ecosystem which makes it a great choice to use in multiple parts of your codebase. If you have no opinion of your own and want a powerful library which won't limit future needs, Zod is a great choice.” — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- Official first-class examples on the same page include Zod, Yup, Superstruct, scale-ts, Typia, **ArkType**, Effect (via `Schema.standardSchemaV1(...)`), **Valibot**, Sury, `@robolex/sure`, and TypeBox (via `@typeschema/typebox` `wrap()`). — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- Valibot can be passed directly: `publicProcedure.input(v.object({ name: v.string() })).output(v.object({ greeting: v.string() }))`. — [tRPC validators.md on GitHub](https://github.com/trpc/trpc/blob/main/www/docs/server/validators.md)
- ArkType can be passed directly: `publicProcedure.input(type({ name: 'string' }))`. — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- Effect requires wrapping: `.input(Schema.standardSchemaV1(Schema.Struct({ name: Schema.String })))`. — [tRPC validators.md on GitHub](https://github.com/trpc/trpc/blob/main/www/docs/server/validators.md)
- TypeBox is **not** drop-in; tRPC’s example uses `wrap(Type.Object(...))` from `@typeschema/typebox`. — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- tRPC recommends new validator libraries conform to Standard Schema rather than a tRPC-only adapter. — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- Output validators are optional because tRPC already infers return types. Reasons to add `.output()`: untrusted data, and preventing over-exposure of fields. Failed output validation becomes `INTERNAL_SERVER_ERROR`. — [tRPC Input & Output Validators](https://trpc.io/docs/server/validators)
- Subscription output validation is special (async iterators). tRPC documents a **Zod v4** helper (`zAsyncIterable`) for validating yielded values, including `tracked()` envelopes. — [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- tRPC `errorFormatter` can attach `zodError` onto the client-inferred error shape when the cause is `ZodError` and the code is `BAD_REQUEST`. — [tRPC Error Formatting](https://trpc.io/docs/server/error-formatting)
- T3 scaffolded routers validate with Zod (`.input(z.object({ text: z.string() }))`) and put the DB on `ctx`. — [create-t3-app Context7 / CLI examples](https://context7.com/t3-oss/create-t3-app/llms.txt)
- Cal.com’s internal tRPC layer validates with Zod (`zod` 3.25.76 in one architecture dump) and uses a custom errorFormatter that translates ZodError. — [Cal.com tRPC wiki](https://factory.ai/open-source-wikis/cal-com?page=packages%2Ftrpc.md); [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)
- Valibot implements Standard Schema v1 (`schema['~standard'].validate`). Limitation: Standard Schema cannot pass Valibot-specific config such as `abortEarly` or `lang`. — [Valibot: Integrate Valibot](https://valibot.dev/guides/integrate-valibot/)
- Community comparison (not official): Zod ~13 KB monolithic; Valibot tree-shakeable; Valibot v1.0 in 2024. That article still says “tRPC integration: Adapter available” which is **stale relative to tRPC’s first-class Valibot example**. — [js2ts.com Zod vs Valibot](https://js2ts.com/zod-vs-valibot); contradicted on the adapter point by [tRPC validators](https://trpc.io/docs/server/validators)

### Inferences

- For a tRPC app, Zod is the path of least friction: tRPC examples, T3, Cal.com, shadcn forms, and `errorFormatter` snippets all assume Zod.
- Valibot is a real 2026 alternative for edge/Workers bundle budgets because it is Standard Schema + documented by tRPC, not a second-class adapter.
- ArkType is officially supported but has a thinner forms/ORM/docs ecosystem around tRPC than Zod; use it when the team already writes ArkType schemas.
- Do not pick a validator “because tRPC needs an adapter.” As of current tRPC docs, Standard Schema is the integration.
- Share one schema between `.input()` and the form library (RHF resolver or TanStack Form Standard Schema) so client and procedure stay in lockstep.

### Gaps

- No official tRPC benchmark of Zod 4 vs Valibot vs ArkType parse cost on procedure hot paths.
- create-t3-app’s published dependency list still showed `zod ^3.24.2` in one npm registry snapshot while tRPC subscription docs already show Zod v4 helpers; which Zod major T3 scaffolds in 2026-09 was not re-verified from a live `package.json` in this pass.
- No first-party tRPC page comparing Zod 4 vs Zod 3 breaking changes for `.input()` specifically.

---

## Database: Prisma vs Drizzle vs Kysely; Neon vs PlanetScale vs Supabase Postgres vs Turso

### Takeaway

**Drizzle + serverless Postgres (Neon or Supabase) is the strongest tRPC pairing in 2026 starters:** schema lives in TypeScript, query results are already typed, and T3 tells you to put `db` on tRPC context. Prisma remains the production-proven choice (Cal.com). Kysely is typed SQL without an ORM and has Neon dialects, but you own more of the type pipeline. Hosted DB: Neon for Vercel/serverless HTTP; Supabase when you want Postgres plus extra platform services while still using Drizzle+tRPC; PlanetScale still in T3 as a MySQL option; Turso/libSQL for SQLite-shaped apps.

### Cited Findings

- T3 Drizzle docs: “We reccommend including the database client in your tRPC Context” and show `createTRPCContext` returning `{ db, session, ...opts }`. Schema is TypeScript at `src/server/db/schema.ts`. — [Create T3 App: Drizzle](https://create.t3.gg/en/usage/drizzle)
- T3 CLI offers **Prisma or Drizzle (not both)** and `--dbProvider` values `mysql | postgres | planetscale | sqlite` (default sqlite). — [Create T3 App: Installation](https://create.t3.gg/en/installation)
- Official T3 introduction still lists Prisma (and NextAuth.js) as “great additions,” with Tailwind “almost always included.” It does not declare Drizzle the new default. — [Create T3 App: Introduction](https://create.t3.gg/en/introduction)
- create-t3-turbo (T3 monorepo starter) uses **Drizzle & Supabase** in `packages/db`, tRPC v11 in `packages/api`. — [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)
- Drizzle has first-party Neon drivers: `drizzle-orm/neon-http` (HTTP, faster for single non-interactive queries; no interactive transactions) and `drizzle-orm/neon-serverless` / websockets when you need sessions/transactions. Cloudflare Worker example is linked from those docs. — [Drizzle: Neon](https://orm.drizzle.team/docs/connect-neon)
- Neon documents Kysely with `kysely-neon` HTTP dialect for edge; HTTP “does not support persistent connections or interactive transactions.” WebSocket or `node-postgres` for transactions. Schema is a TypeScript `Database` interface you maintain. — [Neon: Kysely](https://neon.com/docs/guides/kysely)
- Cal.com production: PostgreSQL + **Prisma**, tRPC handlers stay thin and call feature services; context includes `{ prisma, session, user, ... }`. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture); [Cal.com tRPC package](https://factory.ai/open-source-wikis/cal-com?page=packages%2Ftrpc.md)
- T3 Prisma example routers use `ctx.db.post.create` / `findFirst` inside procedures; types flow from Prisma Client through the procedure return into the client. — [create-t3-app Context7 examples](https://context7.com/t3-oss/create-t3-app/llms.txt)
- Community 2026 guides claim T3 “preferred” DB shifted Prisma+PlanetScale → Drizzle+Neon after PlanetScale free-tier changes and Prisma serverless overhead. This is **not** stated on create.t3.gg’s introduction. — [StackNotice T3 2026](https://stacknotice.com/blog/t3-stack-complete-guide-2026); contrast [T3 Introduction](https://create.t3.gg/en/introduction)
- Same community guides: Drizzle `$inferSelect` / `$inferInsert` replace a separate Prisma-generated client interface; change a column and the TS type changes without `prisma generate`. — [DEV: T3 Stack 2026](https://dev.to/stacknotice/t3-stack-complete-guide-2026-nextjs-15-trpc-v11-drizzle-neon-3ojn)
- Independent ORM comparison (May 2026): Prisma is schema-first + generate; Drizzle is code-first SQL-shaped; Kysely is a typed query builder with no relations/eager-load/migration story of its own. Prisma 7 claimed to run on Workers/Bun/Deno/Vercel Edge via driver adapters without Accelerate as a hard prerequisite. Author’s pick: Drizzle for edge/D1/Turso/Neon; Kysely for analytics-heavy SQL. — [nomadLab: Drizzle vs Prisma vs Kysely 2026](https://nomadlab.cc/blog/2026/05/drizzle-vs-prisma-vs-kysely-2026)
- create-t3-app npm listing includes `@neondatabase` is not named there, but `@libsql/client`, `@planetscale/database`, `postgres`, `mysql2`, `drizzle-orm`, `prisma` are. — [npm create-t3-app](https://registry.npmjs.org/create-t3-app)

### Inferences

- **tRPC-specific ORM quality** is about whether procedure return types are inferred from queries with no DTO layer:
  - **Drizzle:** best DX. Tables are TS; `db.select().from(tasks)` return type is the procedure output. Put `db` on context (T3 pattern).
  - **Prisma:** equally type-safe after generate; Cal.com-scale proof. Extra generate step and heavier client; still excellent with tRPC because `ctx.prisma.x` return types flow out.
  - **Kysely:** types are excellent for SQL, but you maintain the `Database` interface (or codegen it). No first-class T3/tRPC template. Use when SQL is the product.
- **Hosted Postgres vs MySQL vs SQLite with tRPC:**
  - **Neon:** best match for Vercel + Drizzle HTTP driver + edge. Pick when you want serverless Postgres and scale-to-zero.
  - **Supabase Postgres:** best when the team already wants Auth/storage/realtime from Supabase **or** when using create-t3-turbo’s Drizzle package. Do **not** also use the Supabase JS client as a second API beside tRPC unless you have a split (public Realtime vs internal tRPC).
  - **PlanetScale:** still a T3 `--dbProvider planetscale` MySQL path. Pick for existing PlanetScale/MySQL, Vitess-style branching, or if the org is already there. Community T3 writing in 2026 prefers Neon for new apps.
  - **Turso / libSQL:** T3 sqlite path (`@libsql/client`). Pick for local-first, edge SQLite, or tiny apps. Weaker Postgres ecosystem (Auth.js/Better Auth adapters exist for sqlite; some plugins assume Postgres).
- Interactive transactions in tRPC mutations: avoid Neon HTTP / Kysely-neon HTTP; use Neon WebSocket, `postgres`/`pg` on Node, or Prisma/Drizzle with a transaction-capable driver.

### Gaps

- No official 2026 tRPC or T3 bake-off of Prisma 7 driver adapters vs Drizzle neon-http on Vercel Fluid/Cloudflare.
- PlanetScale Postgres (if generally available in 2026) was not verified from PlanetScale’s own docs in this pass; T3 still documents PlanetScale as a distinct provider alongside `postgres`.
- Turso + tRPC production write-ups were not found; evidence is T3 sqlite/libsql scaffolding only.
- How well Drizzle relational `with` vs Prisma `include` round-trips through superjson was not measured.

---

## Auth: Auth.js / NextAuth vs Clerk vs Better Auth vs Lucia successor. Cookie vs JWT with tRPC context.

### Takeaway

For a **new** tRPC app in 2026, **Better Auth is the open-source default** (Auth.js’s own migration guide says so; Auth.js is now maintained by the Better Auth team; create-t3-turbo uses it). **Clerk** is the hosted alternative with an official tRPC context guide. **Auth.js v5** is for existing NextAuth apps (security patches continue; no urgent migrate). **Lucia is deprecated** (March 2025); there is no Lucia-successor npm library to adopt. Sessions should be **cookie-based opaque tokens** resolved in `createContext` via `getSession({ headers })` / `auth()`; JWTs belong in a plugin or mobile/non-cookie clients, not as the default tRPC browser transport.

### Cited Findings

- Auth.js docs: “The Auth.js project is now part of Better Auth.” Existing apps need not migrate urgently (security patches continue). **New projects: “we strongly recommend using Better Auth.”** Both support stateless (JWT) and database sessions. — [Auth.js: Migrating from Auth.js to Better Auth](https://authjs.dev/getting-started/migrate-to-better-auth)
- Better Auth announcement: Auth.js (formerly NextAuth.js) is maintained by the Better Auth team; new projects should start with Better Auth unless a specific Auth.js-only gap exists (the post originally called out stateless sessions; Auth.js migrate page now says Better Auth supports stateless sessions). — [better-auth: Auth.js joins Better Auth (source MDX)](https://github.com/better-auth/better-auth/blob/canary/docs/content/blogs/authjs-joins-better-auth.mdx)
- Auth.js v5 rewrite: server usage collapses to `auth()` instead of `getServerSession(authOptions)`. Two session strategies; with an adapter it defaults to `database`. — [Auth.js: Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5)
- Lucia: “Lucia was deprecated in March 2025. This website was updated in July 2026.” Replacement is a **single-file** `code/auth_session.ts`, not a successor framework. — [lucia-auth.com](https://lucia-auth.com/)
- Secondary source (Aug 20, 2026 package check): `lucia` and `@lucia-auth/adapter-drizzle` deprecated on npm; `better-auth` latest active (`1.7.1` cited); `next-auth@beta` was v5 (`5.0.0-beta.32`) while `next-auth` latest dist-tag still v4 (`4.24.15`). Treat npm dist-tags as time-sensitive. — [StarterPick: Auth.js v5 vs Lucia vs Better Auth 2026](https://starterpick.com/guides/authjs-v5-vs-lucia-v3-vs-better-auth-2026)
- create-t3-app CLI: `--nextAuth` **and** `--betterAuth` flags; Better Auth scaffold uses `drizzleAdapter` and `export type Session = typeof auth.$Infer.Session`. — [Context7 create-t3-app](https://context7.com/t3-oss/create-t3-app/llms.txt)
- create-t3-turbo `packages/auth` is **better-auth**. — [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)
- T3 still documents NextAuth.js + Drizzle schema models (User, Session, Account, VerificationToken) and putting `session` on tRPC context. — [Create T3 App: Drizzle](https://create.t3.gg/en/usage/drizzle)
- Cal.com tRPC `createContext` looks up **NextAuth session** and exposes it; `authedProcedure` requires that session. Cookie-authenticated web app; separate Nest REST API uses API keys/OAuth/JWT. — [Cal.com tRPC](https://factory.ai/open-source-wikis/cal-com?page=packages%2Ftrpc.md); [Cal.com architecture](https://factory.ai/open-source-wikis/cal-com?page=overview%2Farchitecture.md)
- Clerk official guide: wrap `TRPCProvider` in `ClerkProvider`; `createContext` is `{ auth: await auth() }` from `@clerk/nextjs/server`; `protectedProcedure` middleware throws `TRPCError({ code: 'UNAUTHORIZED' })` if `!ctx.auth.userId`. Demo repo: Clerk + Next.js + tRPC + Prisma. — [Clerk: Integrate Clerk into Next.js + tRPC](https://clerk.com/docs/guides/development/trpc)
- Better Auth session model: **cookie-based**; `session_token` is an opaque server-side identifier. Optional `session.cookieCache` writes a short-lived signed `session_data` cookie (JWT-like cache, **not** interchangeable with the JWT plugin’s `/token` endpoint). Stateless mode stores session in a signed/encrypted cookie with no DB read. — [Better Auth: Session Management](https://better-auth.com/docs/concepts/session-management)
- Server session for Next.js: `auth.api.getSession({ headers: await headers() })` vs Auth.js `await auth()`. — [Auth.js migrate guide](https://authjs.dev/getting-started/migrate-to-better-auth)
- Production-shaped tRPC context (community app): `auth.api.getSession({ headers: req.headers })` on the Fetch adapter; WebSocket context copies `cookie` (and optional `x-api-key`) into a `Headers` object then `getSession`. — [norish-recipes context.ts](https://github.com/norish-recipes/norish/blob/c6f32c57/server/trpc/context.ts)
- tRPC fetch adapter context receives `{ req, resHeaders }` (`FetchCreateContextFnOptions`), i.e. you read cookies/headers from the Request, not from a global. — [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- Known pitfall: calling Next.js `headers()` / `getServerSession` inside a **module-scope** `createCaller(await createContext())` can throw `headers was called outside a request scope` in production builds. Context must be created per request. — [tRPC discussion #5704](https://github.com/trpc/trpc/discussions/5704)
- Better Auth + tRPC callers: pass request headers into `getSession`; Discord/AnswerOverflow thread notes Clerk’s Next SDK can call `headers()` internally while Better Auth wants them passed. Monorepo typing of `$Infer.Session` needs `strict: true`. — [AnswerOverflow: getSession with tRPC callers](https://www.answeroverflow.com/m/1335077157289984111)

### Inferences

- **tRPC integration pattern is the same for all three live options:** resolve session in `createContext`, expose `session`/`user`/`auth` on `ctx`, gate with `protectedProcedure` middleware that throws `UNAUTHORIZED`. None of them replace tRPC.
- **Cookies vs JWT with tRPC:**
  - Browser SPA/Next: cookies + `credentials: 'include'` on httpBatchLink. Auth libraries set httpOnly cookies; tRPC should not mint its own JWT for the web client.
  - Better Auth cookie cache ≈ short-lived JWT in a cookie for skipping DB, while the real session id stays opaque.
  - JWT / Bearer: use Better Auth JWT plugin, Clerk `getToken`, or Auth.js jwt strategy when the client cannot store cookies (Expo in create-t3-turbo, third-party API). Put `Authorization` on the tRPC httpLink headers; read it in `createContext`.
- **Pick Better Auth** for self-hosted org/2FA/passkeys/plugins + Drizzle schema generation + TypeScript inference (`$Infer.Session`).
- **Pick Clerk** when you want hosted user management UI, orgs, and the shortest tRPC context (one `auth()` call). Cost and data residency are the tradeoff.
- **Pick Auth.js v5** only to keep an existing NextAuth architecture; do not start v4. Confirm you are on Auth.js v5 / `auth()`, not `next-auth@4` just because the `latest` dist-tag lagged.
- **Do not pick Lucia** as a library in 2026. If you want Lucia-style ownership, copy the documented single-file session helper or use Better Auth.

### Gaps

- No official Better Auth “tRPC” page equivalent to Clerk’s; integration is composed from `getSession` + tRPC context (examples are community/T3).
- Expo/create-t3-turbo cookie vs bearer details for the shared `packages/api` router were not fetched from source.
- Whether `next-auth` npm `latest` is still v4 as of 2026-09-21 was not re-checked on npm in this pass (StarterPick’s check was 2026-08-20).

---

## Data fetching: TanStack Query (required?) vs vanilla tRPC client. Server-side callers / RSC helpers.

### Takeaway

TanStack Query is **not required**. tRPC’s recommended React path in 2026 is **`@trpc/tanstack-react-query` + TanStack Query v5** (not the classic `@trpc/react-query`). Use a vanilla `createTRPCClient` when you do not need cache/keys. On the server, use `createCallerFactory` / `appRouter.createCaller(ctx)` (no HTTP). For RSC, prefetch via `createTRPCOptionsProxy` into a QueryClient; a raw caller does **not** hydrate the client cache.

### Cited Findings

- tRPC: “❓ Do I have to use an integration? **No!** The integration is fully optional. You can use `@tanstack/react-query` using just a vanilla tRPC client, although then you'll have to manually manage query keys and do not get the same level of DX.” — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- New TanStack integration “is simpler and more TanStack Query-native” (QueryKeys / QueryOptions / MutationOptions factories). tRPC “recommend[s] using this over the classic client.” Install: `@trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query`. Bun and Deno install commands are documented. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Classic `@trpc/react-query` RSC docs say that integration “while still supported… is not the recommended way to start new tRPC projects with TanStack React Query.” — [tRPC classic RSC server components](https://trpc.io/docs/client/react/server-components)
- RSC overview: “RSC on its own solves a lot of the same problems tRPC was designed to solve, so you may not need tRPC at all.” Prefetch with `createTRPCOptionsProxy`; for data that stays on the server, “creating a server caller and using it directly” — that caller is “detached from your query client and does not store the data in the cache.” — [tRPC RSC + TanStack Query](https://trpc.io/docs/client/tanstack-react-query/server-components); [Next.js App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup)
- App Router HTTP: `fetchRequestHandler` from `@trpc/server/adapters/fetch`, not `@trpc/next` (Pages Router). Export GET and POST. — [tRPC Next.js App Router](https://trpc.io/docs/client/nextjs/app-router-setup)
- `createCallerFactory(appRouter)` then pass Context: official purpose includes “server-side calls and for integration testing of your tRPC procedures.” Also `router.createCaller({})`. — [tRPC server-side calls (GitHub docs)](https://github.com/trpc/trpc/blob/main/www/docs/server/server-side-calls.md)
- T3 includes `@tanstack/react-query` and `@trpc/react-query` / `@trpc/client` / `@trpc/server` (v11 in one npm snapshot). — [npm create-t3-app](https://registry.npmjs.org/create-t3-app)
- Cal.com client is React Query flavored (`trpc.viewer.bookings.list.useQuery`). — [Cal.com tRPC package](https://factory.ai/open-source-wikis/cal-com?page=packages%2Ftrpc.md)

### Inferences

- **React Query is required for a good interactive tRPC UI** (cache, invalidation after mutations, optimistic updates, SSR hydration). It is not required for scripts, CLIs, or RSC-only pages that only `createCaller`.
- New apps should use `@trpc/tanstack-react-query` (`useQuery(trpc.x.queryOptions())`), not copy v10 `trpc.x.useQuery()` tutorials.
- Split usage: RSC `caller.posts.list()` for server-only data; `prefetchQuery(trpc.posts.list.queryOptions())` + `HydrationBoundary` when the client will keep using the same query.
- Vanilla client is the right lean choice for non-React consumers (Expo can still use Query; a worker/script should not).

### Gaps

- Exact deprecation timeline of `@trpc/react-query` vs “still supported” is not a sunset date in the fetched docs.
- Vue/Svelte/Solid Query integrations were not reviewed in this pass (tRPC is not React-only).

---

## UI: React + Tailwind + shadcn/ui is the T3 default; is that still the best pairing for tRPC apps?

### Takeaway

**Yes for a batteries-included tRPC app in 2026, with a nuance:** official create-t3-app’s core UI is **Next.js + React + Tailwind**, not shadcn (T3 axioms refuse to bundle extra UI kits). **create-t3-turbo** adds a **shadcn-ui** package, Expo, and **TanStack Start**. tRPC itself is UI-agnostic (Fetch adapter lists Astro, Remix, SolidStart, Cloudflare, Deno). The best _pairing_ is still React because that is where tRPC’s Query integration, T3, Clerk’s guide, and Cal.com live.

### Cited Findings

- T3 stack core: Next.js, TypeScript, Tailwind “almost always,” plus optional tRPC / Prisma / NextAuth. Modular; they will not add Zustand/Redux. — [T3 Introduction](https://create.t3.gg/en/introduction)
- create-t3-turbo apps: Next.js 15 + React 19 + Tailwind v4; Expo + NativeWind; TanStack Start v1 (rc) + React 19 + Tailwind v4; `packages/ui` “using shadcn-ui”; shared tRPC API. — [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)
- shadcn form docs are React Hook Form + Zod (Standard Schema note: “you can replace it with any other Standard Schema validation library supported by React Hook Form”). — [shadcn/ui: React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form)
- Cal.com: Tailwind + custom `@calcom/ui`, React Hook Form, not shadcn; tRPC + React Query. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)
- tRPC fetch adapter targets WinterCG runtimes and frameworks including Astro, Remix, SolidStart. — [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- Community T3 2026 tutorials often add Clerk + shadcn; that is **not** the official T3 introduction list. — [StackNotice T3 2026](https://stacknotice.com/blog/t3-stack-complete-guide-2026)

### Inferences

- **Stick with React + Tailwind + shadcn** when you want the densest tRPC examples, form recipes, and turbo monorepo UI package.
- **Skip shadcn** if you want T3-minimal (Tailwind only) or a custom design system (Cal.com).
- **TanStack Start** is the 2026 in-family alternative to Next.js for a Vite-first React tRPC app (create-t3-turbo includes it as rc).
- **Svelte/Vue/Solid** are viable tRPC clients but you lose T3, Clerk’s tRPC guide, and most “copy this `protectedProcedure`” snippets. Only pick them if the UI framework is a hard constraint, not because they are better for tRPC.

### Gaps

- No 2026 official tRPC recommendation of shadcn vs alternatives.
- SvelteKit tRPC adapter maturity vs React was not sourced here.
- Whether TanStack Start in create-t3-turbo is still `rc` as of 2026-09-21 was not re-checked beyond the GitHub README snippet.

---

## Forms: React Hook Form + Zod vs TanStack Form

### Takeaway

**React Hook Form + Zod (or another Standard Schema resolver) remains the default for tRPC+shadcn apps.** TanStack Form v1 is the better typed-state / async-validation / multi-framework pick and can take a Zod/Valibot/ArkType schema directly (Standard Schema; no adapter). tRPC does not care: submit `mutate(values)` from either library into a procedure whose `.input()` uses the same schema.

### Cited Findings

- shadcn’s official forms guide: React Hook Form `useForm` + `zodResolver` + Zod. Note that Zod v3 is in the example, replaceable with any RHF-supported Standard Schema library. — [shadcn/ui React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form)
- Cal.com forms: React Hook Form. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)
- Community 2026 comparison: RHF safest default (ecosystem, shadcn snippets); TanStack Form v1 for type-safe field paths, async validator timing, framework portability; Conform for Next.js/Remix server-action forms. — [PkgPulse: TanStack Form vs RHF vs Conform 2026](https://www.pkgpulse.com/guides/tanstack-form-vs-react-hook-form-vs-conform-react-forms-2026)
- TanStack Form v1 claimed to accept Zod (and Valibot, ArkType, Effect) via Standard Schema without `@tanstack/zod-form-adapter`. One tutorial pinned `@tanstack/react-form@1.33.0` and `zod@4.4.3` (22 June 2026). — [Nerd Level Tech: TanStack Form + Zod](https://nerdleveltech.com/tanstack-form-react-zod-validation-tutorial)
- Side-by-side (Feb 2026): TanStack Form constrains `onChange` types and has `onChangeAsyncDebounceMs`; RHF is ref/uncontrolled and often `any` on change handlers. — [sudomakes: RHF vs TanStack Form](https://sudomakes.art/2026/02/22/react-hook-form-vs-tanstack-form/)

### Inferences

- Share **one Zod (or Valibot) schema** between the form and `procedure.input()` so invalid client payloads never become a second source of truth.
- Map tRPC `BAD_REQUEST` + `zodError` (via errorFormatter) onto field errors; this is well-trodden with RHF, slightly more manual with both libraries.
- Choose TanStack Form if the app already standardizes on TanStack Query/Router/Start and forms are deeply nested or async-validated.
- Conform is relevant only if you abandon tRPC mutations for server actions on those forms (unusual in a tRPC-centric API).

### Gaps

- No official tRPC form recipe.
- shadcn’s TanStack Form guide status as of this date was not fetched (only the RHF page was).

---

## Realtime: tRPC subscriptions (wsLink) vs PartyKit vs SSE vs Pusher. Maturity?

### Takeaway

**tRPC’s own recommendation is SSE (`httpSubscriptionLink`), not WebSockets.** Subscriptions are mature enough for first-party examples (Next SSE chat, Prisma WS starter) with `tracked()` reconnect. **wsLink** is for bidirectional or when you already run a WS server (harder on Vercel). **PartyKit / Durable Objects** are for stateful rooms, not a tRPC subscription transport. **Pusher/Ably** are not first-class; GitHub issue #5618 asked for WSaaS support because classic observables hold the serverless isolate open.

### Cited Findings

- tRPC: subscriptions keep a persistent connection and reconnect using `tracked()` events. “If you are unsure which one to use, **we recommend using SSE** for subscriptions as it's easier to setup and doesn't require setting up a WebSocket server.” — [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- Reference apps: SSE full-stack `trpc/examples-next-sse-chat`; WS full-stack `trpc/examples-next-prisma-websockets-starter`; bare Node WS standalone-server. — [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- `tracked(id, data)`: client sends last known id. SSE uses EventSource `lastEventId` in `.input()`; WS via `wsLink`. 5xx errors reconnect; other errors cancel. — [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- Output validation of subscriptions documented with a Zod v4 `zAsyncIterable` helper. — [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- Open feature request (not implemented as official transport): Pusher/Ably/WSaaS because unsubscribe callbacks require the serverless execution to live for the subscription duration. — [trpc#5618](https://github.com/trpc/trpc/issues/5618)
- Community skill notes: splitLink routing subscriptions to `httpSubscriptionLink` and queries/mutations to `httpBatchLink`; prefer SSE unless you need bidirectional WS. — [skills.re tRPC subscriptions](https://skills.re/skills/trpc/trpc/subscriptions)
- PartyKit material (secondary/marketing): Durable Object rooms, hibernation, collaboration; compared to Socket.io/Pusher, not to tRPC SSE. — [Latest from Tech Guy: PartyKit 2026](https://latestfromtechguy.com/article/partykit-realtime-collaboration-2026) (low editorial quality; do not treat as vendor docs)

### Inferences

- **Default realtime for tRPC: SSE subscriptions** on the same origin as the API. Works with the Fetch adapter story (Vercel/Cloudflare) better than a dedicated WS process.
- **Use wsLink** when clients must send streaming data up, or you already have a long-lived Node/Fly/Railway process (Cal.com-style Docker).
- **Use PartyKit / Cloudflare Durable Objects** for multiplayer presence, CRDTs, games: keep tRPC for CRUD/auth and a separate realtime channel. Do not expect `procedure.subscription` to terminate at PartyKit.
- **Use Pusher/Ably** only as an external bus you publish to from a tRPC mutation, with the client subscribed outside tRPC, until #5618-style adapters exist.
- In-memory `EventEmitter` examples do **not** scale past one instance; production SSE should use DB polling (`tracked` + `lastEventId`) or Redis/pubsub.

### Gaps

- Official PartyKit or Cloudflare Durable Objects + tRPC guide was not found.
- Maturity of SSE on Vercel Fluid / Cloudflare Workers duration limits (idle timeouts) was not documented in the tRPC page fetched.
- Ping.gg / pingdotgg 2026 realtime+tRPC write-up was not found.

---

## Testing: Vitest, Playwright, tRPC caller without HTTP

### Takeaway

**Vitest + `createCallerFactory` (no HTTP) is the official unit/integration path. Playwright is what the official tRPC Next+Prisma starter uses for E2E.** Mock `ctx` (`db`, `session`) and call `caller.router.proc(input)`.

### Cited Findings

- tRPC server-side calls: `createCallerFactory` is “useful for server-side calls **and for integration testing** of your tRPC procedures.” — [server-side-calls.md](https://github.com/trpc/trpc/blob/main/www/docs/server/server-side-calls.md)
- Official example `trpc/examples/next-prisma-starter`: `vitest.config.ts`, `playwright.config.ts`, scripts `test-unit` (Vitest) and `test-e2e` (Playwright), GitHub Actions lint + E2E. — [trpc next-prisma-starter](https://github.com/trpc/trpc/tree/main/examples/next-prisma-starter)
- Blog pattern: Vitest helper `createCallerFactory(router)({ req, res, user, ...opts })` then `caller.changelog.latest()`. — [Remy Sharp, 2024](https://remysharp.com/2024/06/07/adding-tests-to-a-typescript-next-trpc-project-without-the-faff)
- Starter-kit pattern: mock Drizzle with `vi.fn()`, partial `TRPCContext`, `createCallerFactory(billingRouter)`. — [React Starter Kit: Testing](https://reactstarter.com/testing)

### Inferences

- Prefer caller tests for procedure authz, Zod failures, and business rules (fast, no network).
- Use Playwright for cookie auth + httpBatchLink + UI (login, create entity).
- Do not spin up HTTP in unit tests unless you are testing the fetch adapter, batching, or transformers.

### Gaps

- Official tRPC testing index page (if any) was not fetched beyond server-side-calls.
- MSW vs caller-testing community consensus in 2026 was not researched.

---

## Hosting: Vercel + Neon vs Cloudflare Workers + D1/Hyperdrive vs Railway/Fly Node

### Takeaway

**Vercel + Neon remains the T3-shaped default** (Next App Router + `fetchRequestHandler` + Drizzle neon-http). **Cloudflare Workers is first-class for a standalone tRPC router** via the Fetch adapter; full Next.js on Cloudflare goes through **OpenNext**, not a special tRPC adapter. **D1/Turso** fit Drizzle/SQLite. **Hyperdrive** is for TCP Postgres from Workers (not verified here against Neon’s HTTP driver). **Railway/Fly (Node)** if you need WebSocket subscriptions, long-lived EventEmitters, or Prisma without edge constraints.

### Cited Findings

- tRPC Fetch adapter lists Cloudflare Workers, Deno Deploy, Vercel Edge / Next.js Edge. Cloudflare example: `fetchRequestHandler({ endpoint: '/trpc', req: request, router, createContext })` in `export default { fetch }`. — [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- T3 philosophy does not prescribe deployment, but the stack is Next.js-centric (Vercel-native). Docker compose is documented for T3. — [T3 Introduction](https://create.t3.gg/en/introduction); [Context7 T3 docker snippet](https://context7.com/t3-oss/create-t3-app/llms.txt)
- Cal.com: Vercel and Docker; Postgres; optional Redis, Trigger.dev, Sentry, Checkly. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture); [Cal.com deployment wiki](https://factory.ai/open-source-wikis/cal-com?page=deployment.md)
- OpenNext Cloudflare: `npx @opennextjs/cloudflare migrate`; requires `nodejs_compat` and compatibility date ≥ 2024-09-23; deploy via `opennextjs-cloudflare deploy`, not raw wrangler unless you know why. — [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started); [OpenNext CLI](https://opennext.js.org/cloudflare/cli)
- Drizzle Neon HTTP is aimed at serverless/edge; WS driver for transactions; Node `postgres`/`pg` for serverful. — [Drizzle Neon](https://orm.drizzle.team/docs/connect-neon)
- tRPC install docs include `bun add` and `deno add npm:@trpc/...`. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)

### Inferences

- **Pick Vercel + Neon** for the least novel ops with Next + tRPC + SSE (no separate WS server).
- **Pick Cloudflare Workers + fetch adapter** for a thin tRPC API (Hono/raw Worker) with D1 or Hyperdrive/Neon. Pair with a Vite or TanStack Start frontend.
- **Pick OpenNext** only if the UI is Next.js and the host must be Cloudflare; complexity is in Next-on-Workers, not tRPC.
- **Pick Fly/Railway/Docker Node** for Cal.com-like monoliths, WS subscriptions (`applyWSSHandler`), Prisma without adapters, or Redis+bull.
- Serverless + `procedure.subscription` via WS is the failure mode that motivated SSE and issue #5618.

### Gaps

- Cloudflare Hyperdrive + Drizzle + tRPC official tutorial was not fetched.
- D1 + tRPC batching/latency reports were not found.
- Railway vs Fly operational comparison for tRPC WS was not sourced.

---

## Monorepo: Turborepo + pnpm vs bun. Shared packages for router types.

### Takeaway

**Turborepo + pnpm is the current T3-monorepo standard** (`create-t3-turbo`): `packages/api` exports `AppRouter` + router, `packages/db`, `packages/auth`, `packages/ui`; apps import **`import type { AppRouter }`**. Bun is documented as a package manager for tRPC installs and an experimental turbo migration, but a 2026 create-t3-turbo PR still blocked bun on linker/dedupe bugs. Cal.com uses Yarn + Turbo with `packages/trpc`.

### Cited Findings

- create-t3-turbo: init with Turbo CLI “use PNPM”; `pnpm i`; structure `packages/api` (tRPC v11), `auth` (better-auth), `db` (Drizzle & Supabase), `ui` (shadcn); apps nextjs / expo / tanstack-start. Expo talks to the deployed Next tRPC server. — [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)
- Experimental pnpm→bun PR: bun `linker` is all-or-nothing vs pnpm `publicHoistPatterns`; prettier broke; duplicate vite versions; author called bun issues a **blocker** before migrating (Bun v1.3.0 cited). — [create-t3-turbo PR #1457](https://github.com/t3-oss/create-t3-turbo/pull/1457)
- tRPC client setup: `import type { AppRouter } from '../server/router'` so the reference is erased at compile time. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Cal.com: Yarn/Turbo monorepo; `packages/trpc` contains server routers + React client. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)
- Better Auth typing across packages needs `strict: true` in all tsconfigs. — [AnswerOverflow / Bekacru](https://www.answeroverflow.com/m/1335077157289984111)

### Inferences

- Share **types only** (`export type AppRouter = typeof appRouter`) plus the router implementation in `packages/api`; never import server DB code into the web bundle except via `import type`.
- pnpm catalogs/workspaces are the conservative 2026 choice for a tRPC monorepo.
- bun as **runtime** (`bun test`, `bun add`) is fine; bun as **workspace linker** for a turbo monorepo is not yet the T3 default.
- Yarn is proven at Cal.com scale; do not switch package managers for tRPC reasons.

### Gaps

- Whether create-t3-turbo merged bun later than PR #1457 was not checked (PR was the latest bun evidence found).
- Nx vs Turborepo was not in scope of sources fetched.

---

## Language/runtime: TypeScript strict, bun vs node vs deno

### Takeaway

**TypeScript strict is non-negotiable** for tRPC (and Better Auth session inference). **Node is the production default** for Next.js/T3/Cal.com. **Bun** is a first-class install/dev option in tRPC docs. **Deno** has an official Fetch-adapter Deploy example (`deno add npm:@trpc/server`). Do not pick Deno/Bun to get better tRPC types; pick them for ops.

### Cited Findings

- T3 axiom: “Typesafety Isn’t Optional.” — [T3 Introduction](https://create.t3.gg/en/introduction)
- Cal.com: TypeScript strict mode. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)
- tRPC documents npm/yarn/pnpm/**bun**/`deno add npm:@trpc/server` for the Query integration and Fetch adapter. Deno Deploy sample uses `Deno.serve` + `fetchRequestHandler`. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup); [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- Official Prisma starter: Node >= 18. — [next-prisma-starter](https://github.com/trpc/trpc/tree/main/examples/next-prisma-starter)
- Better Auth monorepo inference: all tsconfigs `strict: true`. — [AnswerOverflow](https://www.answeroverflow.com/m/1335077157289984111)

### Inferences

- Target **Node LTS + TypeScript strict** for Next + tRPC production.
- Use **bun** for local install/test speed; keep Node (or Vercel’s Node) as the deploy runtime unless the whole app is a Worker.
- Use **Deno Deploy** only with the Fetch adapter path, not Next.js T3.
- Enable `strict`, `noUncheckedIndexedAccess` if you want ctx.session narrowing to hurt in the right places.

### Gaps

- bun.ns compatibility with Next.js 15/16 production on Vercel was not sourced.
- Deno + Drizzle + Better Auth combined starter was not found.

---

## Observability (error formatting, Sentry, product analytics)

### Takeaway

tRPC’s observability hook is **`errorFormatter` + adapter `onError`**, typically flattening **ZodError** into the client shape. Production apps (Cal.com) use **Sentry + PostHog** around that, not a tRPC-specific APM. There is no official “tRPC OpenTelemetry” requirement.

### Cited Findings

- `initTRPC.create({ errorFormatter })` infers extra error fields (e.g. `zodError`) to the client. JSON-RPC 2.0 compliant. — [tRPC Error Formatting](https://trpc.io/docs/server/error-formatting)
- Cal.com: Sentry monitoring, PostHog analytics, Unkey rate limiting optional; tRPC `errorFormatter` translates TRPCError and ZodError. — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture); [Cal.com tRPC](https://factory.ai/open-source-wikis/cal-com?page=packages%2Ftrpc.md)
- `createCaller` supports `onError` for non-HTTP invocations (tests/RSC). — [server-side-calls.md](https://github.com/trpc/trpc/blob/main/www/docs/server/server-side-calls.md)
- superjson is the documented transformer so `Date`/`Map`/`Set` survive the wire; must be registered on server `initTRPC` and client links. Alternative: devalue (smaller, less readable). T3 lists `superjson`. Cal.com uses superjson on the handler. — [tRPC Data Transformers](https://trpc.io/docs/server/data-transformers); [npm create-t3-app](https://registry.npmjs.org/create-t3-app); [Cal.com tRPC API DeepWiki](https://deepwiki.com/calcom/cal.com/5.1-trpc-api)

### Inferences

- Always add a Zod (or Standard Schema) flatten in `errorFormatter` so forms can bind field errors.
- Capture `onError` in the fetch handler to Sentry with procedure path (formatter opts include path and type).
- Use superjson if procedures return `Date` from Drizzle/Prisma; skip it in a lean stack if you only return JSON-safe primitives (slightly simpler client).

### Gaps

- No official tRPC + OpenTelemetry or Sentry SDK guide was fetched.
- Axiom/Datadog/trpc-panel/trpc-ui admin tooling was not researched.

---

## Recommended batteries-included stack

### Takeaway

The 2026 batteries-included tRPC stack is **create-t3-turbo shaped, not 2022 T3-on-Prisma-PlanetScale**: Next.js App Router (or TanStack Start), tRPC v11, TanStack Query via `@trpc/tanstack-react-query`, Zod, Drizzle, Better Auth, React 19 + Tailwind v4 + shadcn, RHF, Vitest callers + Playwright, Vercel + Neon or Supabase Postgres, Turborepo + pnpm, Sentry, superjson, SSE if you need realtime.

### Cited Findings

- create-t3-turbo already composes tRPC v11 + better-auth + Drizzle/Supabase + shadcn + Next 15 + Expo + TanStack Start + pnpm. — [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo)
- tRPC recommends Zod, SSE subscriptions, TanStack Query integration, Fetch adapter, `import type { AppRouter }`, superjson. — [validators](https://trpc.io/docs/server/validators); [subscriptions](https://trpc.io/docs/server/subscriptions); [TanStack setup](https://trpc.io/docs/client/tanstack-react-query/setup); [transformers](https://trpc.io/docs/server/data-transformers)
- Auth.js team recommends Better Auth for new projects. — [Auth.js migrate](https://authjs.dev/getting-started/migrate-to-better-auth)
- T3 Drizzle: `db` + `session` on tRPC context. — [T3 Drizzle](https://create.t3.gg/en/usage/drizzle)
- shadcn forms: RHF + Zod. — [shadcn RHF](https://ui.shadcn.com/docs/forms/react-hook-form)
- Official starter testing: Vitest + Playwright. — [next-prisma-starter](https://github.com/trpc/trpc/tree/main/examples/next-prisma-starter)
- Cal.com proves Prisma + NextAuth + Sentry + PostHog + Yarn/Turbo at scale (alternative batteries, not the greenfield default). — [Cal.com architecture](https://calcom-cal-com.mintlify.app/developers/contributing/architecture)

### Inferences

Proposed **batteries-included** (greenfield, 2026):

| Layer         | Choice                                                    | Why (tRPC-specific)                             |
| ------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Language      | TypeScript strict                                         | Router inference + Better Auth `$Infer.Session` |
| Runtime       | Node LTS (Vercel); bun for local                          | T3/Cal.com prod path                            |
| App           | Next.js App Router                                        | `fetchRequestHandler` + RSC caller/proxy        |
| API           | tRPC v11 + superjson + Zod errorFormatter                 | Official                                        |
| Client        | `@trpc/tanstack-react-query` + Query v5                   | Official recommended integration                |
| Validation    | Zod (share with forms)                                    | tRPC default                                    |
| DB/ORM        | Drizzle + Neon (or Supabase Postgres)                     | TS schema → procedure output; T3 context        |
| Auth          | Better Auth cookies; `getSession({ headers })` in context | Auth.js recommendation; turbo starter           |
| UI            | React 19 + Tailwind v4 + shadcn                           | turbo `packages/ui`; Query examples are React   |
| Forms         | RHF + zodResolver, same schema as `.input()`              | shadcn official                                 |
| Realtime      | tRPC SSE + `tracked()` when needed                        | tRPC recommended                                |
| Test          | Vitest `createCaller` + Playwright                        | Official starter                                |
| Host          | Vercel + Neon                                             | Least friction with Next + HTTP driver          |
| Monorepo      | Turborepo + pnpm; `packages/api` exports `AppRouter`      | create-t3-turbo                                 |
| Observability | Sentry `onError` + PostHog                                | Cal.com pattern                                 |

**Swap-ins inside batteries (still first-class):** Clerk instead of Better Auth; Prisma instead of Drizzle (Cal.com); TanStack Start instead of Next (turbo); TanStack Form instead of RHF for hard forms.

### Gaps

- No single vendor publishes this exact matrix as “the 2026 tRPC stack”; it is synthesized from tRPC + T3 turbo + Auth.js + Clerk + Cal.com.

---

## Recommended lean production stack

### Takeaway

Lean means **one runtime, one package, no extra realtime/UI kit/transformer until needed**: Vite or Next App Router, tRPC + Zod + vanilla client _or_ Query if the UI is interactive, Drizzle + SQLite/Turso or Neon, Better Auth (or even Clerk if auth UI is the time sink), Fetch adapter, Vitest callers, deploy Worker or Vercel. Skip shadcn, superjson, SSE, turbo, and Playwright until the product needs them.

### Cited Findings

- tRPC Query integration is optional; vanilla `createTRPCClient` + `httpBatchLink` is documented. — [TanStack React Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- Output validators optional; function validators exist but “in most cases we recommend you use a validation library.” — [validators](https://trpc.io/docs/server/validators)
- SSE is optional until you “need to push real-time updates.” — [subscriptions](https://trpc.io/docs/server/subscriptions)
- T3 `--dbProvider` default is sqlite. — [T3 Installation](https://create.t3.gg/en/installation)
- Cloudflare Worker is a ~15-line `fetchRequestHandler`. — [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- T3 axioms: do not add libraries that do not solve a core problem. — [T3 Introduction](https://create.t3.gg/en/introduction)
- RSC may remove the need for tRPC on some pages. — [tRPC RSC](https://trpc.io/docs/client/tanstack-react-query/server-components)

### Inferences

Proposed **lean production**:

| Layer         | Choice                                                                 | Skip / later                                      |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| App           | Vite React SPA **or** Next App Router without extra cache layers       | TanStack Start until team wants it                |
| API           | tRPC + Zod `.input()` only                                             | `.output()`, superjson until Dates leak           |
| Client        | vanilla client if few screens; add Query when cache/invalidation hurts | `@trpc/react-query` classic                       |
| DB            | Drizzle + Neon HTTP **or** sqlite/Turso                                | Prisma generate, Kysely, PlanetScale              |
| Auth          | Better Auth + cookie `getSession`                                      | Clerk if you refuse to build auth UI; never Lucia |
| UI            | React + Tailwind                                                       | shadcn until you need a component kit             |
| Forms         | controlled tiny forms or RHF                                           | TanStack Form                                     |
| Realtime      | none; invalidate Query after mutation                                  | SSE, WS, PartyKit, Pusher                         |
| Test          | Vitest callers                                                         | Playwright when auth cookies matter               |
| Host          | Vercel **or** Cloudflare Worker                                        | Fly/Railway until WS/long jobs                    |
| Monorepo      | single package, `import type { AppRouter }`                            | turbo/pnpm workspaces until second app (Expo)     |
| Observability | `errorFormatter` + platform logs                                       | Sentry when you have users                        |

Lean is still TypeScript strict. The thing you do **not** strip is Zod on `.input()` and session checks in `protectedProcedure`.

### Gaps

- No production post titled “we run tRPC without React Query in 2026” was found; lean vanilla-client advice is from tRPC docs, not a named company.

---

## Cross-cutting alternatives cheat sheet

Use this when choosing the 2nd/3rd option at each layer.

| Layer         | Best-in-class for tRPC (2026)   | Alternative A               | Alternative B                         | Avoid for new tRPC apps                                                  |
| ------------- | ------------------------------- | --------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| Validation    | Zod                             | Valibot (bundle/edge)       | ArkType / Effect Schema               | Custom parsers unless tiny                                               |
| ORM           | Drizzle                         | Prisma (scale/relations DX) | Kysely (SQL-heavy)                    | TypeORM / untyped `pg`                                                   |
| Database host | Neon Postgres                   | Supabase Postgres           | PlanetScale MySQL / Turso sqlite      | Using Supabase JS **and** tRPC for the same CRUD                         |
| Auth          | Better Auth                     | Clerk                       | Auth.js v5 (existing apps)            | Lucia package, NextAuth v4-only guides                                   |
| Session       | Cookies + `getSession(headers)` | Clerk `auth()`              | Bearer JWT for mobile                 | Putting JWT in localStorage for web                                      |
| Data fetching | `@trpc/tanstack-react-query`    | vanilla client              | RSC `createCaller`                    | New apps on classic-only `@trpc/react-query` without reading the warning |
| UI            | React + Tailwind + shadcn       | Tailwind only / custom DS   | TanStack Start                        | Picking Vue/Svelte “because tRPC is better there”                        |
| Forms         | RHF + same Zod schema           | TanStack Form v1            | Conform (if leaving tRPC for actions) | Formik (not appearing in current tRPC/T3/shadcn paths)                   |
| Realtime      | tRPC SSE                        | tRPC WS on Node             | PartyKit/DO rooms beside tRPC         | Assuming Pusher is a tRPC link                                           |
| Testing       | Vitest createCaller             | Playwright E2E              | HTTP adapter tests                    | Jest-only T3 tutorials                                                   |
| Hosting       | Vercel + Neon                   | CF Workers + fetch adapter  | Fly/Railway Node                      | WS subscriptions on brain-dead serverless                                |
| Monorepo      | Turborepo + pnpm                | Yarn + Turbo (Cal.com)      | bun workspaces (experimental)         | Duplicating AppRouter types by hand                                      |
| Runtime       | Node LTS                        | bun (dev)                   | Deno Deploy (fetch adapter)           | Non-strict TypeScript                                                    |

---

## Source quality notes

- **Highest weight:** trpc.io, create.t3.gg, authjs.dev, better-auth.com, lucia-auth.com, clerk.com, drizzle docs, neon.com, github.com/t3-oss/create-t3-turbo, github.com/trpc/trpc examples.
- **Production corroboration:** Cal.com architecture/wiki (Prisma + NextAuth + tRPC + Zod + superjson + Sentry). Ping.gg 2026 stack post: **not found**.
- **Treat as opinion:** StackNotice/DEV “T3 in 2026” (Clerk+Neon as _the_ T3), PkgPulse, StarterPick npm pin dates, nomadLab ORM essay, PartyKit blog.
- **Conflicts called out:** Official T3 introduction still lists Prisma + NextAuth; turbo starter and Auth.js docs have moved to Drizzle/Supabase + Better Auth. Community articles claim Drizzle “replaced” Prisma as T3 default; create.t3.gg still offers both.
