# Best tRPC web application stack / framework comparison (as of 2026)

Research date: 2026-09-21. Prefer primary docs (trpc.io, tanstack.com, GitHub) over aggregator posts. Stars/downloads used only as weak signals.

Adapter class (used throughout):

- **First-class (tRPC-maintained):** Next.js Pages (`@trpc/server/adapters/next` + `@trpc/next`), Next.js App Router (documented fetch handler), Fetch/edge, Express, Fastify, AWS Lambda, Standalone Node HTTP. Source: [tRPC adapters overview](https://trpc.io/docs/server/adapters).
- **Documented but not a dedicated package:** Remix / React Router (fetch adapter example), Astro, SolidStart, Cloudflare Workers, Deno, Vercel Edge. Source: [Fetch adapter](https://trpc.io/docs/server/adapters/fetch).
- **Community:** `@hono/trpc-server` ([npm](https://www.npmjs.com/package/@hono/trpc-server)), TanStack Start via catch-all `fetchRequestHandler` (examples exist in GitHub; docs pages 404'd during this research).

---

## Why is Next.js historically the default tRPC host? Is that still true with App Router + RSC?

### Takeaway

Next.js became the default because tRPC's design (one TypeScript codebase, colocated router, React Query hooks, SSR/SSG helpers) mapped onto the Pages Router and the T3 stack. In 2026 tRPC still officially recommends App Router for _new Next.js_ projects, but RSC overlaps tRPC's original job, the setup is no longer a single HOC, and Next is no longer the only serious full-stack host.

### Cited Findings

- tRPC's own Next.js intro: "Next.js makes it easy to build a client and server together in one codebase. tRPC makes it easy to share types between them." First-class support exists for **both** App Router and Pages Router. [Next.js Integration | tRPC](https://trpc.io/docs/client/nextjs)
- Adapter overview singles out Next.js as the example of a "full integration," while listing Fetch as the glue for Next.js App Router, Astro, Remix, or SolidStart. [Adapters overview](https://trpc.io/docs/server/adapters)
- Pages Router integration is the historical "batteries included" path: `@trpc/next` HOC (`withTRPC()`), `getServerSideProps` / `getStaticProps`, automatic provider wrapping. Server adapter is `createNextApiHandler` at `pages/api/trpc/[trpc].ts`. [Next.js Integration](https://trpc.io/docs/client/nextjs); [Next.js adapter](https://trpc.io/docs/server/adapters/nextjs)
- App Router is now "the recommended approach for new Next.js projects." It uses the **fetch adapter** (not `@trpc/next`), `@trpc/tanstack-react-query`, manual `QueryClientProvider` + `TRPCProvider`, Server Components + `prefetchQuery`, streaming, Suspense. [Next.js Integration](https://trpc.io/docs/client/nextjs)
- App Router route handler pattern: `app/api/trpc/[trpc]/route.ts` exporting GET and POST via `fetchRequestHandler`. [Next.js adapter App Router section](https://trpc.io/docs/server/adapters/nextjs)
- tRPC's RSC guide states explicitly: "RSC on its own solves a lot of the same problems tRPC was designed to solve, so you may not need tRPC at all." There is "not a one-size-fits-all way" to integrate tRPC with RSCs. Recommended client for new projects is `@trpc/tanstack-react-query`; the older `@trpc/react-query` path is "Classic" and still supported. [RSC setup (tanstack-react-query)](https://trpc.io/docs/client/tanstack-react-query/server-components); older classic guide: [RSC setup (react-query)](https://trpc.io/docs/client/react/server-components)
- `createCaller` / direct procedure calls in a Server Component **do not** populate the React Query cache, so data used in an RSC is not automatically available in client components. That split is intentional (TanStack Query "Advanced Server Rendering" model). [RSC setup](https://trpc.io/docs/client/tanstack-react-query/server-components)
- Prefetch in an RSC can be `void queryClient.prefetchQuery(...)` to stream pending queries (dehydrate includes `status === 'pending'`), or `await` prefetch to block HTML until data exists (slower TTFB, no empty client state). Users reported this as poorly explained vs Pages-style SSR; a maintainer confirmed voiding is for streaming. [tRPC issue #6655](https://github.com/trpc/trpc/issues/6655); [RSC setup](https://trpc.io/docs/client/tanstack-react-query/server-components)
- create-t3-app still documents **Pages Router** files (`pages/api/trpc/[trpc].ts`, `createNextApiHandler`, `pages/users/[id].tsx` + `useQuery`). That is the historical T3 teaching path and lags the official "App Router for new projects" recommendation. [create.t3.gg tRPC usage](https://create.t3.gg/en/usage/trpc)
- Third-party 2026 setup guide: tRPC v11 + Next.js 15 App Router; `@trpc/next` / `@trpc/react-query` are "wrong for App Router"; use `fetchRequestHandler` + `@trpc/tanstack-react-query`. [toolchew, 2026](https://toolchew.com/en/how-to-set-up-trpc-nextjs-app-router/)
- TanStack Query maintainers warn: do **not** use Next.js Server Actions as a `queryFn`. Actions run serially from the client, can stick queries in pending, and cannot be passed by reference. "For fetching data on the client, fetch from an API route or use an RPC layer such as tRPC instead. Server Actions remain a good fit for mutations (`useMutation`)." [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr/)
- tRPC RSC docs mention a separate "Server Actions guide" but the URLs tried (`/client/react/server-actions`, `/client/tanstack-react-query/server-actions`) returned 404 during this research.

### Inferences

- Next.js was the default because (1) colocation of router + UI in one deployable app, (2) `@trpc/next` made SSR/SSG/provider setup a product, (3) T3/Theo evangelism 2021–2024. That productized path is **Pages Router**.
- App Router is still a first-class _documented_ host, but it is a worse fit for tRPC's original design: RSC already gives typed server data fetching; tRPC is now mainly the **client-component / mobile / non-RSC** contract plus React Query cache. Boilerplate is higher (two clients: server proxy + browser client, QueryClient factory, HydrationBoundary).
- "Is Next still the default?" For **greenfield Next.js shops and Vercel**, yes. For **tRPC's design** (React Query as the data layer, colocation without RSC dual-world), TanStack Start or a Vite SPA + Node/Hono API is a closer conceptual match. Next remains the most documented host, not necessarily the best-fitting one.

### Gaps

- Exact current create-t3-app default (App vs Pages) was not verified from the generator itself; only the usage docs, which still show Pages files.
- Official tRPC "Server Actions guide" URL could not be fetched (404). Overlap with Server Actions is therefore cited from TanStack Query docs, not from a live tRPC page.
- No 2026 npm download split was collected for `@trpc/next` vs `@trpc/tanstack-react-query`.

---

## How mature is tRPC on TanStack Start vs Next.js in 2026?

### Takeaway

Next.js remains the mature, first-class tRPC host (dedicated docs, two official client packages, T3 tutorials). TanStack Start in 2026 has a working, production-used pattern (fetch catch-all + TanStack Query + optional isomorphic links) but **no dedicated tRPC adapter**, unstable example URLs, and a first-party RPC alternative (`createServerFn`) that some teams choose instead of tRPC.

### Cited Findings

- tRPC repo added an official example `examples/tanstack-react-start`: Router + tRPC, React Query, SSR query integration, isomorphic client (`makeTRPCClient`: in-process local link on server, HTTP batch + subscription links on client), `TRPCProvider`, subscriptions. [trpc/trpc PR #7024](https://github.com/trpc/trpc/pull/7024)
- TanStack Start still documents (or documented) examples `with-trpc` and `with-trpc-react-query` under the Start docs. The `with-trpc-react-query` page rendered in search as Start "v0" with a CodeSandbox of GitHub `tanstack/router` examples. Fetching `https://tanstack.com/start/latest/docs/framework/react/examples/with-trpc-react-query` and `.../examples/with-trpc` returned **404** on 2026-09-21. Search snippet: [TanStack Start with-trpc-react-query example](https://tanstack.com/start/latest/docs/framework/react/examples/with-trpc-react-query)
- Raw example handlers on GitHub use `defineEventHandler` + `toWebRequest` from `@tanstack/react-start/server` and `fetchRequestHandler` at `/trpc`. [with-trpc-react-query handler](https://raw.githubusercontent.com/TanStack-dev/router/main/examples/react/with-trpc-react-query/trpc-server.handler.ts)
- A Japanese walkthrough dated **2026-04-17** shows the current file-route pattern: `src/routes/api/trpc.$.ts` with `createFileRoute('/api/trpc/$')` `server.handlers` GET/POST → `fetchRequestHandler`; client uses `@trpc/tanstack-react-query` `createTRPCOptionsProxy`. [Zenn: TanStack Start tRPC Setup](https://zenn.dev/web_life_ch/articles/4bce633ca10c58)
- Older API (`createAPIFileRoute` from `@tanstack/react-start/api`) appears in GitHub discussion #3399; APIs have churned. One participant "ended up ditching tRPC … and instead use Tanstack Start server functions." [TanStack/router #3399](https://github.com/TanStack/router/discussions/3399)
- Tanner Linsley (2025-06-06) on first-class tRPC: the Start team consulted tRPC authors; server functions are intentionally _not_ a full tRPC clone (isomorphism, code splitting, colocation). They will **not** enhance API routes to replace tRPC; they will "recommend (and offer examples and integration documentation for) TRPC, hono and many others." "We have no plans to replicate any full stack public api design tools including TRPC." Users later noted the tRPC example disappeared from the examples list. [TanStack/router #3884](https://github.com/TanStack/router/discussions/3884)
- T3 Chat (Theo / Julius) migrated from Next.js to TanStack Start (video dated **2026-01-07**, ~140k views) and **kept tRPC** for "a bunch of random data on the server side," wrapping `TRPCProvider` in the router. The migration was large (14k/10k loc), required patching Start, and they moved API routes (including tRPC) **off Start file routes onto Nitro** because lazy route bundling failed at their scale on Vercel. [Rosetta transcript](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js); [YouTube](https://www.youtube.com/watch?v=Sc5ca-VJdxY); [Theo on X via tweets.vercel.fyi](https://tweets.vercel.fyi/x/theo/1997406196660400228)
- A 2026 aggregator correctly states tRPC "works as an HTTP handler within TanStack Start" and that greenfield Start apps may prefer native server functions; migrations from Next+tRPC can keep the router. Treat as secondary: [StackNotice TanStack Start 2026](https://stacknotice.com/blog/tanstack-start-complete-guide-2026)

### Inferences

- **Maturity gap:** Next.js tRPC is a documented product (adapter + client packages + SSR guides). Start tRPC is "fetch adapter in a catch-all route" plus community/official examples that have been added, removed, and 404'd. Production proof exists (T3 Chat) but that team also had to bypass Start's own API routing.
- Start is a _better conceptual_ host for tRPC+React Query (typed loaders, QueryClient in router context, no RSC dual-world) but a _worse institutional_ host (v0-era docs, Nitro/Vercel edges, competing `createServerFn`).
- If the tRPC router must be a **public HTTP API** (batching, output validation, Expo, OpenAPI, subscriptions), Tanner's own statement is to use tRPC or Hono, not server functions. If the API is only the Start app, server functions compete.

### Gaps

- Could not load a live TanStack Start tRPC example page from tanstack.com (404). Maturity of the _docs surface_ is therefore worse than GitHub examples imply.
- No independent production case studies besides T3 Chat were fetched.
- Start version / 1.0 status not confirmed from a changelog; search snippets still said "Start v0".

---

## How well does tRPC work with Remix / React Router 7 loaders vs its React Query model?

### Takeaway

Remix/RR7 can host tRPC over the fetch adapter and can prefetch via loaders, but tRPC's native model is React Query, not loader-returned data. The supported bridge is `createTRPCQueryUtils` / `ensureData` inside loaders, plus dehydrate/hydrate. There is no `@trpc/remix` equivalent of `@trpc/next`. Dual-sourcing (loader data _and_ `useQuery`) is the main footgun.

### Cited Findings

- Fetch adapter docs include a first-party **Remix** snippet: `app/routes/trpc.$trpc.ts` exporting `loader` and `action` that both call `fetchRequestHandler({ endpoint: '/trpc', req, router, createContext })`. Same page lists Remix alongside Astro and SolidStart as Fetch-based frameworks, not as a dedicated adapter. [Fetch adapter — Remix](https://trpc.io/docs/server/adapters/fetch)
- tRPC docs for `createTRPCQueryUtils`: "The use case … is when you need to use the helpers outside of a React Component, for example in `react-router`'s loaders." Example: `await clientUtils.post.all.ensureData()` then pass `initialData` into `useQuery`. For Remix/SSR, create a **new QueryClient per request** to avoid cache leakage. [createTRPCQueryUtils.md on next branch](https://github.com/trpc/trpc/blob/next/www/docs/client/react/createTRPCQueryUtils.md)
- PR #7162 (route-level prefetching docs): loaders `await utils.post.byId.ensureData({ id })` and `return null` because React Router loaders must return a value; cache is the source of truth. [trpc/trpc PR #7162](https://github.com/trpc/trpc/pull/7162)
- Historical pain: loaders run before the React tree, so `useUtils()` / context is unavailable. Discussion #3148 covered TanStack Router and React Router 6.4; the fix was helpers created **outside** React (`createTRPCQueryUtils` / global client). [trpc/trpc #3148](https://github.com/trpc/trpc/discussions/3148)
- Community Remix SSR gist (2023, still the pattern): `createServerSideHelpers` in `loader`, `json({ trpcState: helpers.dehydrate() })`, client `Hydrate`. [michalhonc gist](https://gist.github.com/michalhonc/7ae24a6e1c5223b2f6794970bf993e70)
- TanStack Query SSR guide describes Remix/loader prefetch: per-request QueryClient in the loader, `prefetchQuery`, dehydrate, hydrate on render. Three QueryClients (loader, SSR render, browser). [TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)
- Theo (2025 exploration, published 2026-01-07): Remix attempt "kind of failed"; Cloudflare deploy was hard; React Router's server edition was "dancing around the standards" and "really, really poorly documented at the time," so he would not bet on it then. [Rosetta transcript](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js)

### Inferences

- Remix/RR7 is a **documented Fetch host** plus a **React Query-compatible loader story**, not a first-class tRPC framework. Fine if the team already lives in loaders and agrees the Query cache is canonical (`ensureData` + `return null`).
- Friction vs tRPC design: Remix wants loader data as the page's data; tRPC+RQ wants query keys, invalidation, mutations, subscriptions. Using both without dehydration duplicates fetches or desyncs.
- React Router 7 (Remix merge) does not change the adapter: still Fetch + file route. Maturity of _docs_ for RR7+tRPC specifically was not found beyond generic react-router loader helpers.

### Gaps

- No official "React Router 7" page on trpc.io was found; Remix snippet still uses `@remix-run/node` types.
- No maintained community `@trpc/remix` package was verified as current in 2026.
- Loader vs RSC streaming comparison (Remix doesn't stream pending Query promises the same way App Router dehydrates `pending`) was not documented on tRPC's Remix snippet.

---

## Is a Vite SPA + Hono/Fastify tRPC server a better DX for API-heavy apps?

### Takeaway

For an API-heavy product (multiple clients, subscriptions/WebSockets, long-running Node, Cloudflare Workers), a dedicated tRPC server (Fastify first-class, Express first-class, Hono community) plus a Vite SPA is often a _cleaner tRPC DX_ than App Router RSC. It is not automatically a better _product_ DX: you lose one-deploy colocation, you take on CORS, cookie/SameSite, and version skew unless you reverse-proxy the API on the same origin.

### Cited Findings

- Adapters overview: for serverful APIs use Standalone, Express, or Fastify; for serverless use Lambda or Fetch; swapping adapters is described as trivial. Standalone is recommended to start when you have no existing HTTP server. [Adapters overview](https://trpc.io/docs/server/adapters)
- **Fastify:** official plugin, prefix `/trpc`, tRPC v11 requires **Fastify v5+** (v4 may return empty responses). `maxParamLength` must be raised for large batches. First-class **WebSockets** via `@fastify/websocket` + `useWSS`. [Fastify adapter](https://trpc.io/docs/server/adapters/fastify)
- **Express:** official `createExpressMiddleware` at `/trpc`. [Express adapter](https://trpc.io/docs/server/adapters/express)
- **Hono:** `@hono/trpc-server` middleware (`app.use('/trpc/*', trpcServer({ router }))`), runs on Cloudflare Workers, Deno, Bun, Node. `createContext` receives Hono context as 2nd argument for `c.env` / headers. Not a tRPC-core adapter. Cloudflare bindings typing has been a recurring issue (#101, #694). [npm @hono/trpc-server](https://www.npmjs.com/package/@hono/trpc-server); [honojs/middleware #101](https://github.com/honojs/middleware/issues/101); [honojs/middleware #694](https://github.com/honojs/middleware/issues/694)
- Fetch adapter lists Cloudflare Workers as a first-class Fetch runtime with a `fetchRequestHandler` worker example. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- Client setup for SPA is the vanilla React Query integration: `httpBatchLink` to `http://localhost:3000/trpc`, headers for auth cookies/tokens. Per-request QueryClient only needed if you add SSR. [React Query setup](https://trpc.io/docs/client/react/setup)
- Theo independently rewrote T3 Chat as **Vite + Hono on Cloudflare** (2025), got SPA + API on one worker working, then abandoned it: Pages→Workers migration was underdocumented, worker **size limits** (3 MB free / 10 MB paid for executable JS) were easy to hit, and he did not want to give up frontend/backend **deploy-together version sync**. He still says Vite+Hono/Fastify is the stack he "wished they had explored more deeply" for a client-first app. [Rosetta transcript](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js)
- create-t3-app documents CORS wrapping of the Next handler specifically "if you need to consume your API from a different domain, for example in a monorepo that includes a React Native app." [create.t3.gg tRPC — Enabling CORS](https://create.t3.gg/en/usage/trpc)
- Hono's own RPC mode is marketed as "like tRPC, but without the tRPC overhead" for edge; that is a competing design, not a tRPC host. Secondary: [DEV: Hono.js in 2026](https://dev.to/ottoaria/honojs-in-2026-the-fastest-web-framework-for-cloudflare-workers-and-why-its-going-mainstream-2aap)

### Inferences

- **API-heavy + multiple clients (web SPA + Expo + maybe webhooks):** Vite SPA + Fastify (Node, WS) or Hono (edge) is the best _tRPC-shaped_ architecture: one router package, HTTP batching, subscriptions, no RSC/`use client` split, no Server Actions confusion.
- **API-heavy + one web app + want SSR/colocation:** not clearly better. You re-implement what Next/Start give you (proxy, cookies, single deploy). Theo's Cloudflare rewrite is evidence that split SPA+API DX can be worse than a "hacked" full-stack framework.
- Same-origin Vite proxy to Fastify/Hono in dev, and a reverse proxy or Start/Nitro/CF routing in prod, recovers cookie DX without CORS.

### Gaps

- No 2026 benchmark of tRPC throughput Fastify vs Hono vs Next route handlers was collected (the DEV Hono RPS table is not tRPC-specific and is an aggregator).
- oRPC was named in TanStack discussion #3884 as an alternative; not researched here.

---

## How does SSR prefetch, hydration, and cookies/auth work on each host?

### Takeaway

All SSR hosts must use a **per-request QueryClient** and dehydrate into the client. Next App Router uniquely streams _pending_ queries over RSC. Cookies work naturally when the tRPC HTTP endpoint is same-origin; RSC `createCaller` can read `cookies()` without HTTP. Mobile and split-origin SPAs should use `Authorization` headers, not cookies.

### Cited Findings

**Shared React Query rules**

- Never share a QueryClient across SSR requests; `staleTime` > 0 to avoid instant refetch after hydrate. [TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/react/guides/ssr); [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr/)
- Prefetch in a "preload" phase (RSC / loader / `getServerSideProps`), dehydrate, hydrate. [TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)

**Next.js App Router**

- Server: `createTRPCOptionsProxy` + `cache(makeQueryClient)` so one client per request. `void prefetchQuery(trpc.x.queryOptions())` + `HydrationBoundary` streams pending promises; `shouldDehydrateQuery` extended to `status === 'pending'`. Await prefetch to block. [RSC + tanstack-react-query](https://trpc.io/docs/client/tanstack-react-query/server-components)
- Client: singleton QueryClient in the browser, new one on the server; `httpBatchLink` to `/api/trpc`; `VERCEL_URL` used to build absolute URL when `window` is undefined. [same]
- Direct `caller.hello()` in an RSC is **detached from the cache**. [same]
- Context on the fetch handler receives the Web `Request` (headers/cookies). Inner T3 pattern: `createTRPCContext` reads session from `opts.req`. [create.t3.gg](https://create.t3.gg/en/usage/trpc)

**Next.js Pages Router**

- `@trpc/next` HOC, SSR and SSG helpers, automatic providers. [Next.js Integration](https://trpc.io/docs/client/nextjs)
- Node `IncomingMessage`/`ServerResponse` adapter: cookie headers are normal Node HTTP. [Next.js adapter](https://trpc.io/docs/server/adapters/nextjs)

**TanStack Start**

- Official tRPC example: isomorphic client, in-process link on server (no HTTP hop for SSR prefetch), HTTP batch + subscriptions in the browser; QueryClient wired in `getRouter()`, SSR query integration. [PR #7024](https://github.com/trpc/trpc/pull/7024)
- Route loaders can `ensureQueryData` (T3 Chat thread route: loader ensures Convex/tRPC-related query data for `threadId`). [Rosetta transcript](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js)
- Fetch `createContext` gets `Request` headers. Cookie auth is same-origin `/api/trpc`.

**Remix / React Router**

- Loader: prefetch + dehydrate `trpcState`; or `createTRPCQueryUtils.ensureData` and return null. New QueryClient per request. [createTRPCQueryUtils](https://github.com/trpc/trpc/blob/next/www/docs/client/react/createTRPCQueryUtils.md); [gist](https://gist.github.com/michalhonc/7ae24a6e1c5223b2f6794970bf993e70)
- Cookie/session: Remix `loader` `Request` → `createContext`. Same-origin `/trpc` route.

**Vite SPA + separate API**

- Default: **no SSR prefetch**. Auth via `httpBatchLink.headers` (`getAuthCookie()` or Bearer). [React Query setup](https://trpc.io/docs/client/react/setup)
- Cross-origin: CORS + `credentials: 'include'` or stop using cookies. T3 CORS snippet. [create.t3.gg CORS](https://create.t3.gg/en/usage/trpc)

**Expo / React Native**

- Cookies are a poor fit; real-world v11 setup uses `httpBatchLink` + `Authorization: Bearer` from SecureStore against the Next `/api/trpc` URL. [DEV: sharing tRPC v11 types Next + Expo](https://dev.to/hirodeath/sharing-trpc-v11-types-between-nextjs-and-expo-a-real-world-indie-web-ios-setup-3067)
- Clerk + T3 Turbo: wrap Expo in `ClerkProvider` + `TRPCProvider`; `protectedProcedure` on the shared router. [Clerk + T3 Turbo](https://clerk.com/blog/clerk-t3-turbo)

**Fetch context shape**

- `FetchCreateContextFnOptions`: `{ req, resHeaders }`; sample reads `req.headers.get('username')`. Set-Cookie would go on `resHeaders`. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)

### Inferences

- Closest to tRPC's SSR story: **Pages Router** (HOC) and **TanStack Start isomorphic link** (prefetch without HTTP). App Router streaming is more powerful and more confusing.
- Cookie sessions assume same-site HTTP. RSC `createCaller` can skip HTTP entirely (good for web, useless for Expo).
- Split SPA+API should prefer bearer tokens or a same-origin proxy; cookie auth across origins is the usual footgun.

### Gaps

- Exact App Router cookie helper (`cookies()` from `next/headers` inside `createTRPCContext`) is widely used in tutorials but was not copied from a live official snippet in this pass (T3 docs still show Pages `opts.req`).
- WebSocket/SSE cookie auth on Fastify vs fetch SSE on Start was not compared in depth (Fastify documents `useWSS`; Start example includes subscriptions in PR #7024).

---

## Deployment implications: Vercel, Cloudflare Workers, Node servers, Lambda

### Takeaway

tRPC deploys wherever its adapter runs. Vercel+Next (or Vercel+Start/Nitro) is the path of least resistance for a colocated app. Cloudflare is first-class for Fetch/Hono but has strict worker size limits. Node Fastify/Express is the subscription/WebSocket-friendly path. Lambda is officially supported with batching and (newer) streaming caveats.

### Cited Findings

- **Vercel / Next:** App Router handlers and Pages API routes; `VERCEL_URL` in official RSC client URL helper. [RSC setup](https://trpc.io/docs/client/tanstack-react-query/server-components). Edge: Fetch adapter + Next.js Edge / Vercel Edge examples. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- **Vercel / TanStack Start:** T3 Chat stayed on Vercel after leaving Next; Fluid Compute remained the reason. Deploying a large Start app was "rough"; they used Nitro `serverDir` so API/tRPC routes were separate functions; lazy Start API routes caused `EMFILE` / fetch failures at ~60% rollout. [Rosetta](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js); [Theo tweet thread](https://tweets.vercel.fyi/x/theo/1997406196660400228)
- **Cloudflare Workers:** Official Fetch example (`wrangler dev`). [Fetch adapter](https://trpc.io/docs/server/adapters/fetch). Hono middleware targets Workers. [npm @hono/trpc-server](https://www.npmjs.com/package/@hono/trpc-server). Theo: worker JS size **3 MB free / 10 MB paid**; easy to hit with SSR frameworks and native-ish deps; static assets are separate and can be larger. [Rosetta](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js)
- **Node servers:** Standalone, Express, Fastify adapters. Fastify WS for subscriptions. [Adapters overview](https://trpc.io/docs/server/adapters); [Fastify](https://trpc.io/docs/server/adapters/fastify)
- **AWS Lambda:** Official adapter for API Gateway REST (v1), HTTP API (v2), Function URLs. `httpBatchLink` needs a **single** API Gateway resource that catches the tRPC path. Response streaming via `awsLambdaStreamingRequestHandler` + `awslambda.streamifyResponse()` for Function URLs and REST with `responseTransferMode: STREAM`. [AWS Lambda adapter](https://trpc.io/docs/server/adapters/aws-lambda)
- **Deno Deploy / Vercel Edge / Astro SSR:** Fetch adapter examples. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)

### Inferences

- Choose host by **runtime limits**, not by tRPC features (features are adapter-stable).
- Colocated Next/Start on Vercel: simplest cookies + version skew story (Theo's original reason to use Next).
- Cloudflare: great for a small Hono tRPC API; risky as the host of a large SSR React app.
- Lambda: fine for request/response tRPC; batching and streaming need explicit Gateway config; WebSockets are not this adapter's story (use Fastify or a WS platform).

### Gaps

- No first-party tRPC + Cloudflare Durable Objects / Queues guide was fetched.
- Netlify / Fly.io / Railway not covered.
- TanStack Start's current Nitro deploy matrix (which presets are stable in 2026) was not read from Start's own deploy docs (example URLs 404'd).

---

## Monorepo vs single Next.js app for sharing the tRPC router with a mobile client

### Takeaway

Sharing with Expo is a solved tRPC pattern: export `AppRouter` as a **type-only** dependency and point `httpBatchLink` at the HTTP endpoint. A single Next (or Hono) app can serve mobile if you add CORS and bearer auth. A monorepo `packages/api` (T3 Turbo) is the recommended structure once more than one runtime imports the router, so clients never bundle server code.

### Cited Findings

- tRPC discussion #6980 (2025+): do not import from `apps/api`; extract `packages/api`. Clients add it as a (dev) dependency and import **types only** (erased at compile). Shared Zod schemas that run on the client go in `packages/types`. Called out as the **T3 Turbo** pattern. [trpc/trpc #6980](https://github.com/trpc/trpc/discussions/6980)
- Clerk on T3 Turbo: Next + Expo, shared `packages/api` routers, `protectedProcedure` for mobile-authenticated creates. [Clerk blog](https://clerk.com/blog/clerk-t3-turbo)
- Indie 2026-relevant writeup: router **stays inside Next.js**; `packages/api` only re-exports `AppRouter`; Expo hits `https://web/api/trpc` with SuperJSON + Bearer from SecureStore. "One less server to deploy." [DEV: Next + Expo tRPC v11](https://dev.to/hirodeath/sharing-trpc-v11-types-between-nextjs-and-expo-a-real-world-indie-web-ios-setup-3067)
- Boilerplate: Next.js 15 App Router + Expo 53 + Turborepo, `packages/trpc` shared routers. [smcroissant/boilerplate-next-expo-trpc](https://github.com/smcroissant/boilerplate-next-expo-trpc)
- Eagerworks training (Hono API app + web + mobile): `packages/trpc` defines router; `apps/api` mounts `@hono/trpc-server`; web and mobile both `createTRPCReact<AppRouter>()`. [Eagerworks shared packages](https://onboarding.eagerworks.com/training/fullstack/shared_packages.html)
- create-t3-app CORS section exists specifically for RN/monorepo cross-domain. [create.t3.gg](https://create.t3.gg/en/usage/trpc)
- Theo on colocation: keeping frontend and backend on the **same version** (one deploy) avoids a large class of bugs; splitting hosts makes rollbacks and schema migrations harder. That argument favors a single Next/Start app _as the HTTP server_ even when Expo is a second client. [Rosetta](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js)

### Inferences

- **Single Next app** is enough when Expo is a thin client of the same API and you accept CORS + token auth. Simplest ops.
- **Monorepo `packages/api`** is better as soon as Start/Vite/Hono/Expo all import the router, or when Zod schemas are reused in mobile forms. Type-only imports are the invariant; runtime server code must not ship to RN/web bundles.
- RSC `createCaller` is web-only. Mobile always goes over HTTP, so the fetch/Express/Hono handler is the real public contract. Designing procedures as a public API (not as RSC-only callers) is required for Expo.
- Auth model should be header-based from day one if mobile is in scope; cookie `protectedProcedure` that only reads Next cookies will not work on Expo without a second path.

### Gaps

- create-t3-turbo's 2026 maintenance status (App Router? Expo SDK?) was not checked on GitHub beyond the Clerk article and discussion #6980.
- No sourced comparison of EAS update vs API versioning (mobile clients can be stale; tRPC has no built-in proto compatibility layer). Mentioned as a design risk, not a cited vendor recommendation.

---

## Concrete community consensus (T3, Theo, TkDodo, GitHub, 2025–2026 posts)

### Takeaway

Consensus in 2026 is split by app shape, not by a single winner. Next.js + tRPC is still the documented default and T3 teaching stack (Pages docs lag App Router). Client-first / highly interactive teams are moving to TanStack Start, often keeping tRPC for the public API while using Start server functions for colocated RPC. TkDodo's line is clear: React Query + tRPC (or fetch) for queries; Server Actions for mutations only. Remix/RR7 is a supported Fetch host, not the community default.

### Cited Findings

**Official tRPC ranking signals**

- Next.js is the only framework with a dedicated client integration section and a dedicated server adapter page; App Router is recommended for new Next projects; Pages remains fully supported. [Next.js Integration](https://trpc.io/docs/client/nextjs)
- RSC guide: you may not need tRPC at all if you only fetch in Server Components. [RSC setup](https://trpc.io/docs/client/tanstack-react-query/server-components)
- Fetch adapter explicitly names Remix, Astro, SolidStart, Cloudflare, Deno, Vercel Edge. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- New TanStack Query client (`@trpc/tanstack-react-query`) is the recommended React integration; classic `@trpc/react-query` still supported. [RSC setup](https://trpc.io/docs/client/tanstack-react-query/server-components)

**T3 / create-t3-app**

- create-t3-app remains the on-ramp that made Next the default tRPC host; usage docs still walk Pages Router + SuperJSON + `httpBatchLink` + session context. [create.t3.gg/en/usage/trpc](https://create.t3.gg/en/usage/trpc)
- T3 Turbo remains the cited monorepo+Expo pattern. [trpc #6980](https://github.com/trpc/trpc/discussions/6980); [Clerk + T3 Turbo](https://clerk.com/blog/clerk-t3-turbo)

**Theo (2026-01-07)**

- T3 Chat left Next.js for TanStack Start because they had **hacked React Router into Next** (`ssr: false`, rewrites, custom `x-trpc` header so tRPC was not eaten by SPA fallback). Quote: "If the Next.js router is not the right router for your app, then Next.js is not the right framework for your app."
- They still use tRPC on Start; they still deploy on Vercel; Julius chose Start, not Theo; Theo had tried Remix, Vite+Hono on Cloudflare, and Start.
- He explicitly refuses a universal stack recommendation: "If you're here looking for advice on what stack to build your next project with, I got nothing for you."
- [Rosetta](https://rosetta.to/u/t3dotgg/i-moved-off-of-next-js); [YouTube](https://www.youtube.com/watch?v=Sc5ca-VJdxY); [tweet clarification](https://tweets.vercel.fyi/x/theo/1997406196660400228)

**Tanner / TanStack (2025)**

- Server functions ≠ tRPC replacement for public APIs; tRPC and Hono are the recommended API layers. [discussion #3884](https://github.com/TanStack/router/discussions/3884)
- Some production users drop tRPC for `createServerFn` when they do not need a public API. [#3399](https://github.com/TanStack/router/discussions/3399)

**TkDodo / TanStack Query (canonical, not a tweet)**

- Advanced SSR + App Router streaming is the model tRPC's new docs defer to. [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr/)
- Do not use Server Actions as `queryFn`; use tRPC or an API route for client fetches; Server Actions OK for `useMutation`. [same]
- Issue #6655: tRPC Discord + GitHub; void vs await prefetch; maintainers point at TkDodo's streaming SSR page. [trpc #6655](https://github.com/trpc/trpc/issues/6655)

**Secondary 2025–2026 narrative posts (weaker)**

- "Post-Next.js" landscape: Start for typed routing / non-Vercel; RR7 for simpler SSR than RSC; Next still default for Vercel ecosystem. [TopInsight](https://topinsight.co/dev-infra/tanstack-start-modern-fullstack/)
- r/nextjs thread on T3 Chat leaving Next cited as social moment (Dec 2025); upvote counts from an aggregator, not independently verified. [same]

**Other 2025–2026 hosts (serious but secondary)**

- **Astro SSR** and **SolidStart**: Fetch adapter examples only; no dedicated client integration. [Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- **Hono RPC** (not tRPC) as an edge-native typed RPC competitor. [DEV Hono 2026](https://dev.to/ottoaria/honojs-in-2026-the-fastest-web-framework-for-cloudflare-workers-and-why-its-going-mainstream-2aap)
- **oRPC** named next to tRPC in Start discussion; not evaluated. [#3884](https://github.com/TanStack/router/discussions/3884)

### Inferences — ranking by fit to tRPC's design (e2e TS, React Query, colocation, SSR prefetch)

This is an inference from the findings above, not a poll.

| Rank | Host                                                    | Fit                                                                                                                  | Adapter class                                          | When it wins                                                                  |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1    | **TanStack Start + tRPC HTTP handler + TanStack Query** | Best conceptual match: typed routers, QueryClient in router, loaders as prefetch, isomorphic link, no RSC dual-world | Fetch in catch-all (examples; not a dedicated package) | Client-first full-stack app that still wants a public tRPC API (web + mobile) |
| 2    | **Next.js Pages Router + `@trpc/next`**                 | Best _productized_ match historically: HOC, SSR/SSG helpers, colocation                                              | First-class                                            | Existing T3/Pages apps; do not migrate for fashion                            |
| 3    | **Vite SPA + Fastify tRPC (same-origin proxy)**         | Pure tRPC+RQ; first-class WS; no RSC overlap                                                                         | First-class Fastify                                    | API-heavy, subscriptions, Node, SPA UX                                        |
| 4    | **Next.js App Router + `@trpc/tanstack-react-query`**   | Official recommended Next path; streaming prefetch is excellent; RSC overlaps tRPC and splits caller vs cache        | First-class docs + Fetch adapter                       | Vercel, SEO/RSC, one Next codebase, need client hooks anyway                  |
| 5    | **Vite/SPA or Start UI + Hono tRPC (Cloudflare)**       | Excellent edge API DX; community adapter; worker size limits                                                         | Community `@hono/trpc-server` or Fetch                 | Edge, D1/KV bindings, small API surface                                       |
| 6    | **Remix / React Router 7 + Fetch + query utils**        | Works; loaders vs RQ dual model; no dedicated client package                                                         | Documented Fetch example                               | Team already committed to RR loaders                                          |
| 7    | **Single Next/Start app as HTTP server + Expo client**  | Not a competing web framework; best _mobile sharing_ story                                                           | Type-only `AppRouter` + HTTP                           | Web + iOS/Android                                                             |
| 8    | **AWS Lambda adapter**                                  | Fine as a host, not a full web app framework                                                                         | First-class                                            | Existing Gateway; batching/streaming configured                               |

**Practical 2026 consensus, compressed:**

- Need Vercel + RSC + one repo → **Next App Router + tRPC** (keep tRPC for client components, mutations, Expo; use `createCaller` in RSCs).
- Need SPA snappiness + typed routing + still want tRPC → **TanStack Start** (expect to maintain the fetch route yourself; consider Nitro for APIs at scale).
- Need a real API for many clients → **extract `packages/api`**, host on Fastify (Node/WS) or Hono (Workers), consume from Vite/Start/Next/Expo.
- Do not pick Remix/RR7 _for tRPC_; pick it for loaders, then bolt tRPC on.
- Do not use Next Server Actions as a tRPC replacement for queries (TkDodo).

### Gaps

- No tRPC Discord archive was readable from here; Discord is only cited via GitHub issue #6655.
- No npm download or GitHub star tables were collected (assignment said treat as weak signal only).
- Theo/T3 "official" create-t3-app App Router template status in 2026 not verified from the CLI.
- TkDodo personal blog posts beyond the TanStack Query docs were not fetched; the Advanced SSR guide is the citable maintainer position.
- SolidStart / Astro depth is "exists as Fetch example" only.
