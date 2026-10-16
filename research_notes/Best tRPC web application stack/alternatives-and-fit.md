# When tRPC is the wrong API choice, and competing TypeScript-first stacks (2026)

Research date: 2026-09-21. This note is even-handed: tRPC remains a strong default for same-repo TypeScript React apps, but that premise is wrong for public APIs, non-TypeScript clients, contract-first organizations, and several framework-native stacks.

Source-quality note: Official docs (`trpc.io`, `orpc.dev`, `ts-rest.com`, `hono.dev`, `elysiajs.com`, `pothos-graphql.dev`, `create.t3.gg`) are treated as primary. Production writeups (`cal.com` blog, Cal.com architecture wikis) are treated as primary for who uses tRPC. Comparison blogs (LogRocket, Kanopy, PkgPulse, APIScout, sidlynx) are secondary; several of them still claim tRPC has no OpenAPI, which official tRPC docs now contradict via an **alpha** `@trpc/openapi` package. Vendor benchmarks from oRPC are cited as vendor-provided, not independently verified here.

## What does tRPC require (TypeScript both sides, no public OpenAPI by default, same-repo or published types)?

### Takeaway

tRPC is a TypeScript-to-TypeScript RPC layer: the client imports the **type** of the server router (`AppRouter`), not a generated SDK, and TypeScript inference is the contract. It is not a public HTTP product by default. OpenAPI exists now as a first-party **alpha** add-on, not as tRPC's default contract.

### Cited Findings

- tRPC's homepage pitch is end-to-end typesafe APIs with no codegen: "Experience the full power of TypeScript inference" and "no code generation, runtime bloat or build step." — [tRPC homepage](https://trpc.io)
- Creator Alex/KATT: "I built tRPC to allow people to move faster by removing the need of a traditional API-layer, while still having confidence that our apps won't break as we rapidly iterate." — [tRPC homepage](https://trpc.io); also quoted on [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- The client is created by passing `AppRouter` as a generic: `createTRPCClient<AppRouter>({ links: [httpBatchLink({ url })] })`. Types flow from server implementation to client. — [tRPC vanilla client docs](https://trpc.io/docs/client/vanilla)
- Create T3 App: "Notice that we only need to export our router’s type definitions, which means we are never importing any server code on our client." Sharing the **type** (same repo, or a published types package) is the integration model. — [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- GitHub README lists: production-ready, full static typesafety, no codegen, "zero deps and a tiny client-side footprint," adapters for React/Next.js/Express/Fastify, "tRPC is not tied to React, and there are many community adapters." License: MIT. ~40.5k stars at time of fetch. — [trpc/trpc README](https://github.com/trpc/trpc/)
- Official OpenAPI package `@trpc/openapi` is **alpha**: "This package is in alpha. APIs may change without notice." It generates OpenAPI 3.1 from the router with no annotations required, but subscriptions are excluded, transformers must match on generated clients, and GET inputs use tRPC's `?input=` encoding rather than normal query params. — [tRPC OpenAPI (alpha)](https://trpc.io/docs/openapi)
- Create T3 App's still-current external-API guidance: calling procedures without the tRPC client is "a bit different"; recommended paths are (1) wrap a single procedure in a normal HTTP handler via server-side caller, or (2) community `trpc-openapi` with extra metadata. "tRPC communicates over HTTP... the syntax can be cumbersome due to the RPC protocol." — [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- LogRocket (2025-12-08) listed as a tRPC limitation: "Not ideal for public APIs... It doesn’t generate OpenAPI specs." That claim is now **stale relative to official alpha OpenAPI**, but it still reflects how the community framed tRPC through 2025. — [LogRocket: tRPC vs oRPC](https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/); contradicted on the OpenAPI point by [tRPC OpenAPI (alpha)](https://trpc.io/docs/openapi)
- oRPC's comparison table marks tRPC OpenAPI as 🟡 (third-party / incomplete), contract-first as 🛑, Standard Schema as ✅. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- Runtime validation is typically Zod (or another Standard Schema library) on procedures; types without a validator are compile-time only. Create T3 App uses Zod for procedure inputs and SuperJSON as the data transformer so `Date` survives the wire. — [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- tRPC is RPC over HTTP, not resource REST: procedures, not `GET /users/:id`. Request batching is a first-class feature (`httpBatchLink`). — [trpc/trpc README](https://github.com/trpc/trpc/); [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)

### Inferences

- The hard requirement is **TypeScript on both sides of the type import**. The server can be Node, serverless, or edge via adapters; the client can be React, a vanilla TS client, or React Native. What cannot participate is a consumer that cannot import `AppRouter`.
- "Same repo" is the happy path. Separate repos work if the server publishes the `AppRouter` type (and matching transformer). That is still a TypeScript package contract, not an OpenAPI contract.
- OpenAPI is no longer "community-only," but it is also not "tRPC's default." Treating `@trpc/openapi` alpha as equivalent to oRPC/ts-rest first-class OpenAPI would overstate maturity.

### Gaps

- Official `https://trpc.io/docs/why` 404s as of this research; positioning is taken from the homepage, GitHub README, and T3 docs instead.
- No official tRPC page was found that states a hard "you must be in a monorepo" rule. Same-repo vs published-types is inferred from how `AppRouter` is imported.
- Exact minimum TypeScript version / "both sides must be TS" is implied everywhere but not quoted as a single FAQ sentence in the pages fetched.

## How do public APIs, mobile non-TS clients, and third-party integrations change the recommendation?

### Takeaway

Those three consumers flip the recommendation. tRPC is an **internal** TypeScript SDK. Public APIs, Swift/Kotlin/Java/C#/Python clients, and partner integrations need a language-neutral HTTP contract (REST + OpenAPI, or GraphQL). Teams that still want tRPC internally should dual-stack, as Cal.com does.

### Cited Findings

- Sidlynx: "tRPC is excellent for first-party TypeScript clients, but Java, C#, mobile, partners, and public integrations need an explicit contract. That usually means REST plus OpenAPI." "The mistake is not using tRPC. The mistake is pretending its TypeScript contract is also an external API contract." Decision questions include: primary consumers TS in the same release process? Java/C#/native mobile/partners? Stable URLs and long deprecation windows? Is OpenAPI a byproduct or source of truth? — [When tRPC is not enough](https://sidlynx.me/blog/when-trpc-is-not-enough/)
- APIScout (2026 comparison): "Client and server must share a TypeScript codebase. tRPC doesn't work for public APIs, third-party integrations, or non-TypeScript clients (mobile apps in Swift/Kotlin, partners consuming your API)." Also: "tRPC is RPC, not REST. There are no resource URLs, no HTTP caching at the URL level, no standard clients." — [tRPC vs GraphQL vs REST for TypeScript 2026](https://apiscout.dev/guides/trpc-vs-graphql-vs-rest-2026)
- LogRocket: tRPC is "intended for internal APIs where a client and server share the same codebase"; "other languages (like Python, Go, or Java) can’t easily consume its endpoints"; tight coupling "can slow down independent deployments in larger organizations." — [LogRocket: tRPC vs oRPC](https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/)
- Cal.com production architecture: tRPC is "the Next.js front end's primary API" at `/api/trpc/[trpc]`. Separately, "REST v2" in `apps/api/v2` is "deployed separately and powers the official REST API plus the Platform SDK ('atoms')" for "Platform SDK consumers, third-party integrators" using "API keys, OAuth, JWT." tRPC auth is NextAuth session cookies. — [Cal.com architecture wiki](https://factory.ai/open-source-wikis/cal-com?page=overview%2Farchitecture.md); [Cal.com tRPC wiki](https://factory.ai/open-source-wikis/cal-com?page=api%2Ftrpc.md)
- Create T3 App documents CORS specifically "if you need to consume your API from a different domain, for example in a monorepo that includes a React Native app." That is **TypeScript** mobile, not Swift/Kotlin. — [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- Official OpenAPI alpha is explicitly aimed at "Generate a typed API client in any language," Postman/Insomnia, and "AI agent integrations such as MCP servers." Transformers remain a cross-language problem; docs recommend EJSON (MongoDB) or Amazon Ion when SuperJSON is not viable. GET still encodes `?input=` not ordinary query params. Subscriptions omitted. — [tRPC OpenAPI (alpha)](https://trpc.io/docs/openapi)
- Kanopy (2026, secondary): "If you ever need to expose your API to mobile apps built in Swift or Kotlin, to partners, or to any non-TypeScript consumer, tRPC becomes a wall. You'll end up building a separate REST or GraphQL layer alongside it." "If external API consumers or auto-generated documentation are requirements, tRPC is the wrong choice. Full stop." — [Kanopy: tRPC vs Hono RPC vs ts-rest](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest)
- oRPC positioning: convert a tRPC router with `toORPCRouter` to get OpenAPI 3.1 generation and REST request handling; tRPC error formatting is **not** supported through that conversion. — [oRPC tRPC integration](https://orpc.dev/docs/openapi/integrations/trpc)

### Inferences

- React Native + web in one TypeScript monorepo is still a tRPC-shaped product. Native iOS/Android written in Swift/Kotlin is not.
- The Cal.com pattern is the production-proven answer for mixed audiences: tRPC for the first-party web app, a separate versioned REST API for partners. Do not wait until a partner asks for Postman to invent that split.
- Alpha OpenAPI generators that still require tRPC query encoding and matching transformers do not make tRPC a good **public API product**. They are a bridge for TS-adjacent consumers and tooling.
- Independent deploy / separate backend team is a softer but real reason to leave tRPC: the "instant break on the client" DX becomes a coordination tax.

### Gaps

- No 2026 official tRPC guidance was found that says "never use tRPC for public APIs" in those words; the limitation is inferred from protocol + T3 "how do I call my API externally" + community/production dual-stack patterns.
- No quantitative survey of how many tRPC apps later add a REST facade.

## oRPC vs tRPC in 2025-2026 (OpenAPI, Standard Schema, TanStack Query). Is oRPC replacing tRPC in new T3-like stacks?

### Takeaway

oRPC is the closest "tRPC plus public contract" challenger: first-class OpenAPI 3.1, Standard Schema, TanStack Query without a React provider, and an official tRPC migration path. It is **not** replacing tRPC in T3. Create T3 App still ships tRPC; T3 maintainers refused to drop it for Server Actions; oRPC's own install snippets still pin `@orpc/*@beta`.

### Cited Findings

- oRPC comparison (vendor): oRPC vs tRPC vs Hono. tRPC lacks contract-first (🛑), OpenAPI is 🟡, Standard Schema is ✅ on both oRPC and tRPC. oRPC claims first-party TanStack Query for React **and** Vue/Solid/Svelte/Angular; tRPC's non-React Query column is 🟡. Both have Next.js Server Actions support. oRPC claims typed errors, File/Blob, SSE, `ReadableStream` more completely than tRPC. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- oRPC OpenAPI: `OpenAPIGenerator` emits OpenAPI 3.1 by default (3.2 partial); converters for Zod, Valibot, ArkType; fallback to Standard JSON Schema. Same procedures can be served as RPC and as REST. — [oRPC OpenAPI Specification](https://orpc.dev/docs/openapi/openapi-specification)
- Official migration guide maps `t.router()` → plain object, `.query`/`.mutation` → `.handler`, `TRPCError` → `ORPCError`, SuperJSON → built-in serializer. Install commands uninstall `@trpc/*` and install `@orpc/server@beta @orpc/client@beta @orpc/tanstack-query@beta`. TanStack Query usage is `createTanstackQueryUtils(client)` then `useQuery(orpc.planet.list.queryOptions(...))` **without** a React provider. — [Migrating from tRPC](https://orpc.dev/docs/migrations/from-trpc)
- Existing tRPC apps can wrap rather than rewrite: `toORPCRouter` + `OpenAPIGenerator`, with the caveat that tRPC error formatting is unsupported. — [oRPC tRPC integration](https://orpc.dev/docs/openapi/integrations/trpc)
- Vendor benchmarks on that comparison page (oRPC 2.0.0-beta.37 vs tRPC 11.19.0 vs Hono 4.13.8, no-op handlers): RPC HTTP throughput 20,279 req/s oRPC vs 4,821 tRPC (~4.2x); gzip bundle 14.5 kB oRPC vs 23.7 kB tRPC (tRPC figure includes SuperJSON) vs 17.0 kB Hono; typecheck on 3,000 procedures 1.62s / 469 MB oRPC vs 2.32s / 677 MB tRPC. Page itself says treat numbers as reference measurements, not a reason to switch. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- LogRocket (2025-12-08) recommendation table: all-TS one team → tRPC; OpenAPI/SDK/mobile/Python/Go/partners/contract-first/future public API → oRPC. — [LogRocket: tRPC vs oRPC](https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/)
- PkgPulse (secondary, 2026): "tRPC v11 is still the easiest default" for one TypeScript codebase; oRPC "when you want tRPC-like DX plus OpenAPI"; "oRPC is the most interesting challenger because it solves real problems tRPC deliberately ignores." — [oRPC vs tRPC v11 vs ts-rest 2026](https://www.pkgpulse.com/guides/orpc-vs-trpc-v11-vs-ts-rest-2026)
- Create T3 App still asks "Would you like to use tRPC?" and the default noninteractive package list includes `"trpc"`. — [create-t3-app CLI](https://github.com/t3-oss/create-t3-app/blob/4709861f/cli/src/cli/index.ts)
- T3 maintainer Christopher Ehrlich on replacing tRPC with Server Actions: "No. We do 'support' server actions... But we have no plans to get rid of tRPC. The Next.js team recommends using a data access layer... tRPC is that data layer for us." Reasons: DX, type safety, React Query in client components, setup already done. — [create-t3-app#1456](https://github.com/t3-oss/create-t3-app/issues/1456)

### Inferences

- Feature-wise, oRPC is designed as "tRPC's missing public-API story" rather than a different product category. That is why it is the alternative people compare first in 2025–2026.
- "Replacing tRPC in new T3-like stacks" is **not** supported by T3 itself. The T3-like default remains Next.js + tRPC + TanStack Query + Zod. oRPC is a parallel ecosystem still labeling packages `@beta` on its migration page.
- Teams starting **greenfield** who already know they need OpenAPI have a reason to skip tRPC and start on oRPC or ts-rest. Teams whose API is internal-only still have a reason to stay on tRPC's larger, older ecosystem.
- oRPC's first-party Vue/Svelte/Angular Query integrations are a concrete advantage if the company is not React-centric.

### Gaps

- No announcement was found that create-t3-app, T3, or Theo adopted oRPC as the default API layer.
- No independent reproduction of oRPC's 4.2x throughput numbers.
- Unclear how stable oRPC 2.0-beta is in large production vs tRPC v11.
- Theo commentary 2024–2026 beyond the older homepage tweet and T3 maintainer issue was not captured as a dedicated 2026 post in this pass.

## ts-rest, Hono RPC, and Eden Treaty (Elysia) as typed RPC alternatives

### Takeaway

These three keep **real HTTP** (paths, methods, status codes) and infer a typed client from a contract or `typeof app`. They are the right typed alternatives when tRPC's procedure-not-URL model is the problem. They are not drop-in DX clones of tRPC + React Query.

### Cited Findings

- **ts-rest** official: "Contract-First API," "It's just HTTP/REST," Standard Schema validation, optional OpenAPI generation. Shared `contract` object is implemented on the server and consumed by `initClient`. Supports Nest, Next.js, Express, Fastify. Client stays close to HTTP: always a status code + body. — [ts-rest.com](https://ts-rest.com)
- ts-rest GitHub: "RPC-like client, contract, and server implementation for a pure REST API"; "No Code Generation"; "Full optional OpenAPI integration"; "Small Bundle Size"; incrementally adoptable. — [ts-rest/ts-rest](https://github.com/ts-rest/ts-rest)
- **Hono RPC** official: export `typeof` the Hono app as `AppType`; client is `hc<AppType>(url)`. Calls look like `client.posts.$post({ form: {...} })`. Response is a fetch `Response`. Status codes passed to `c.json(..., 200)` become typed unions on the client. Standard Schema validators work, not only Zod. Requires `strict: true` in both tsconfigs for monorepos. — [Hono RPC guide](https://hono.dev/docs/guides/rpc)
- oRPC vs Hono (vendor): Hono has OpenAPI ✅, contract-first ✅, but 🛑 typesafe at scale, 🛑 SSE, 🛑 batch requests, 🛑 TanStack Query first-party (🟡 React only). Hono OpenAPI REST throughput ~18.7k vs oRPC ~19.8k in the same vendor bench. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- **Eden Treaty** official: RPC-like client for Elysia, "weighing less than 2KB," no codegen. `treaty<App>(host)` yields `app.nendoroid({ id }).put(body)`. Lists tRPC, Remix, SvelteKit, Nuxt, TS-Rest as other e2e-typesafe frameworks. Eden Fetch is a fetch-shaped alternative without WebSocket support. — [Elysia Eden overview](https://elysiajs.com/eden/overview.md)
- Kanopy (secondary, treat performance numbers as unverified): tRPC client ~12 KB gzip; Hono client ~2 KB; ts-rest client ~8 KB. Claims tRPC v11 "stable since late 2025." Claims tRPC "has no native OpenAPI support" (stale vs official alpha). Positions: tRPC for TS monorepo/Next; Hono for edge + real HTTP; ts-rest for contract-first REST and separate teams. — [Kanopy: tRPC vs Hono RPC vs ts-rest](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest)
- PkgPulse (secondary): "In 2026, tRPC wins for pure TypeScript monorepos; ts-rest wins when you need REST + OpenAPI; Hono RPC wins for edge deployments with Hono's performance profile." — [Hono RPC vs tRPC vs ts-rest](https://www.pkgpulse.com/guides/hono-rpc-vs-trpc-vs-ts-rest-type-safe-api-clients-2026)

### Inferences

- Pick **ts-rest** when the API _is_ REST, teams are split, or OpenAPI/SDK generation is a requirement. You pay contract boilerplate to keep HTTP semantics.
- Pick **Hono RPC** when the server is already Hono (especially Workers/edge) and you want typed `fetch`, not a procedure tree. Do not expect tRPC-depth DX, subscriptions, or first-class React Query.
- Pick **Eden Treaty** only if the server is Elysia/Bun. It is a framework feature, not a portable API layer.
- None of these replace TanStack Query; you wire `useQuery` yourself except where ts-rest ships `@ts-rest/react-query`.

### Gaps

- Hono's documented type-scale limits (oRPC says Hono RPC types "become effectively unusable" at 3,000 procedures) were not independently verified.
- No Eden Treaty vs tRPC production migration writeup was found.
- ts-rest vs `@hono/zod-openapi` OpenAPI quality was not compared from generated specs.

## GraphQL (Pothos), REST + Zod, and framework-native APIs

### Takeaway

These are the non-RPC answers. GraphQL (Pothos) fits many clients and field-level queries. REST + Zod (or OpenAPI-first) fits public HTTP products. Next.js Server Actions, SvelteKit load/actions, and Remix loaders often remove the _need_ for tRPC inside one framework.

### Cited Findings

- Pothos is a TypeScript GraphQL schema builder: infer resolver types, plugins for Prisma/Drizzle/Zod, auth, pagination, batching. Output is a standard GraphQL.js schema for Yoga, Apollo, or any GraphQL server. — [Pothos GraphQL](https://pothos-graphql.dev)
- tRPC homepage tweet from Lee Byron: Theo and mxstbr (GraphQL) "agree that both are awesome and there’s a time and a place for each." — [tRPC homepage](https://trpc.io)
- APIScout (secondary): REST type safety via OpenAPI + `openapi-typescript` is good when disciplined and poor when types are handwritten. Mentions `trpc-openapi` as a bridge and `zodios` as a Zod-typed REST client. GraphQL still wins when clients need to select fields and when non-TS clients are first-class. — [tRPC vs GraphQL vs REST 2026](https://apiscout.dev/guides/trpc-vs-graphql-vs-rest-2026)
- Kent C. Dodds, quoted on tRPC's homepage: "If I didn't already get end-to-end type safety from @remix_run, I would 100% be investigating @trpcio very seriously. If you're not on Remix, I suggest you give it a look." — [tRPC homepage](https://trpc.io)
- Elysia lists Remix, SvelteKit, and Nuxt alongside tRPC as frameworks that already have e2e type safety. — [Elysia Eden overview](https://elysiajs.com/eden/overview.md)
- tRPC's own RSC docs: "RSC on its own solves a lot of the same problems tRPC was designed to solve, so you may not need tRPC at all." — [tRPC + React Server Components](https://trpc.io/docs/client/tanstack-react-query/server-components)
- Create T3 App comparison to a Next.js API route: tRPC removes URL bookkeeping, method checks, ad-hoc query validation, and untyped `fetch`. That is the job Server Actions + Zod libraries (`next-safe-action`, `zsa`) also claim. — [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc); [tRPC Server Actions blog](https://trpc.io/blog/trpc-actions)

### Inferences

- If the product _is_ a public API or a data graph for many clients (web, mobile, partners, BI), GraphQL or OpenAPI-first REST is the product; tRPC is at most an internal BFF.
- If the app never leaves one full-stack framework, native loaders/actions can make tRPC redundant. That is the Remix/SvelteKit/RSC argument, not a claim that tRPC is technically incompatible.
- REST + Zod without ts-rest/oRPC is still a valid 2026 stack: OpenAPI as source of truth, `openapi-typescript` or Zod schemas shared in a package. More ceremony, more interoperability.

### Gaps

- Pothos vs tRPC production migration stories were not fetched.
- SvelteKit and Remix official docs on loaders/actions were not re-fetched in this pass; the "already typesafe" claim is supported by Kent's quote and Elysia's list, not a primary framework citation here.

## Next.js Server Actions vs tRPC: overlap and when people drop tRPC

### Takeaway

Server Actions overlap tRPC **mutations in a Next.js-only UI**. They do not replace a cacheable, batchable, multi-client API. T3 is keeping tRPC. Community split: some App Router teams drop tRPC for Actions + optional React Query; tRPC official docs recommend a hybrid.

### Cited Findings

- tRPC docs (Server Actions, `experimental_`): "Server Actions are not a replacement for all tRPC mutations." Use Actions for progressive enhancement / forms that do not need the React Query cache. Use `useMutation` for cache updates, optimistic updates, complex loading/error UI. Incremental adoption; no need to rewrite the API. Integration is `experimental_caller` + `experimental_nextAppDirCaller`. "The API may change in future releases." — [tRPC Server Actions](https://trpc.io/docs/client/nextjs/server-actions)
- tRPC blog: Server Actions are not a silver bullet for dynamic data; keep React Query + `useMutation` there. Mentions `next-safe-action` and `zsa` as non-tRPC typed-action libraries. — [Using Server Actions with tRPC](https://trpc.io/blog/trpc-actions)
- T3: no plans to replace tRPC with Server Actions; tRPC is the data access layer; React Query in client components is a stated reason to keep it. — [create-t3-app#1456](https://github.com/t3-oss/create-t3-app/issues/1456)
- DEV article (secondary): Actions for simple forms / single web client; tRPC when you need batching, query caching, or web+mobile. "No. Server Actions replace a lot of the small API routes that used to exist only to handle form submissions." — [Next.js Server Actions vs tRPC](https://dev.to/mudassirworks/nextjs-server-actions-vs-trpc-how-to-actually-choose-17e7)
- r/nextjs thread: one team finds Actions cannot revalidate a sliver of a highly dynamic page and run serially, so they keep tRPC/API for those views and Actions for cheap forms. Another: "I went from tRPC -> Server Actions with zsa and haven’t looked back... tRPC was great for the pages router, but found it really cumbersome to setup in the app router." icflorescu (tRPC-SvelteKit author / tRPC ecosystem contributor): boilerplate+batteries → tRPC; quick solution → Server Actions. — [tRPC vs Server Actions (r/nextjs)](https://www.reddit.com/r/nextjs/comments/1etpoup/trpc_vs_server_actions/)
- tRPC RSC guide acknowledges overlap with RSC data fetching and documents a TanStack Query hydration path for App Router. — [tRPC + RSC](https://trpc.io/docs/client/tanstack-react-query/server-components)

### Inferences

- People drop tRPC when: App Router + RSC already fetch on the server; mutations are forms; there is only one Next.js client; the tRPC App Router setup cost feels higher than Actions.
- People keep tRPC when: dashboards need client cache, optimistic updates, batching, subscriptions, or a second client (Expo/RN, Vite).
- "Best tRPC stack" in 2026 Next.js is hybrid: RSC/loaders for first paint, tRPC + TanStack Query for interactive client islands, optional experimental Actions for progressively enhanced forms.

### Gaps

- No market share numbers for "T3 with tRPC" vs "T3-like with only Server Actions."
- Serial-execution limitation of Server Actions may have changed after the 2024 Reddit thread; not re-verified against 2026 Next.js docs here.

## SvelteKit / Vue / Angular: is tRPC first-class or a mismatch?

### Takeaway

tRPC is React-Query-first. A vanilla client works anywhere TypeScript runs. SvelteKit, Vue, and Angular integrations exist but are community-grade, version-lagged, or poorly documented. SvelteKit shops in particular already have typed `load` and form actions; adding tRPC is usually a mismatch unless sharing a router with a React app.

### Cited Findings

- tRPC homepage: "adapters for React, Next.js, Express, Fastify, AWS Lambda, Solid, Svelte, and more" and "Framework agnostic." — [tRPC homepage](https://trpc.io)
- Official vanilla client: use it "with a frontend framework for which we don't have an official integration." Do **not** use it in React when TanStack React Query integration is available (caching, loading, invalidation). — [tRPC vanilla client](https://trpc.io/docs/client/vanilla)
- `https://trpc.io/docs/client/svelte` 404s as of this research (page not found).
- **SvelteKit:** `icflorescu/trpc-sveltekit` is a community adapter. README: "tRPC-SvelteKit v3.x.x is compatible with tRPC v10. If you're using tRPC v9, use tRPC-SvelteKit v2." Node/Vercel/Netlify adapters; experimental WebSockets only with `adapter-node`. — [trpc-sveltekit](https://github.com/icflorescu/trpc-sveltekit/)
- oRPC comparison marks TanStack Query for Vue/Solid/Svelte/Angular as ✅ for oRPC and 🟡 for tRPC. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- **Angular:** multiple community clients: `@heddendorp/trpc-link-angular` + tanstack-angular-query (extracted from tRPC repo, peers `@trpc/client 11.4.3`); `ngx-trpc`; `ngx-trpc-client` whose README says "Using TRPC with Angular is not very well documented." — [heddendorp/trpc-angular](https://github.com/heddendorp/trpc-angular); [ngx-trpc](https://github.com/lennybakkalian/ngx-trpc); [ngx-trpc-client](https://github.com/BeGj/ngx-trpc-client)
- Kanopy (secondary): "tRPC is essentially tied to the React ecosystem for first-class support." Hono client is framework-agnostic fetch. ts-rest claims React Query, Vue Query, and Angular HttpClient. — [Kanopy](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest)

### Inferences

- The sweet spot named in the research brief is correct: **React + TanStack Query**. That is the documented, batteries-included path.
- SvelteKit: community adapter stuck on tRPC v10 is a practical red flag for a v11 shop. Native `+page.server.ts` `load` and form actions already give typed server functions. tRPC on SvelteKit is justified mainly to share procedures with a React/RN client.
- Vue: vanilla or Vue Query wrapping `@trpc/client` works; it is not T3-grade.
- Angular: possible, not first-class; expect to pick a community library and maintain it.

### Gaps

- Official Solid adapter was claimed on the homepage but not fetched.
- Vue `usetrpc` / TanStack Vue Query official examples were not fetched (one search returned no useful Vue-specific official doc).
- AnalogJS tRPC (Angular) was mentioned as inspiration in ngx-trpc README but not reviewed.

## Notable production users and notable departures

### Takeaway

Cal.com is the best-documented large production user, and it **did not** make tRPC its public API. T3/Ping-adjacent React/Next apps are the cultural center. High-profile "we left tRPC" posts are scarce; the real departures are architectural (add REST, or never adopt tRPC because Remix/RSC/Actions suffice), not angry rewrites.

### Cited Findings

- **Cal.com / Cal.diy:** tRPC is the web app's primary API (`viewer.*` authed, `publicViewer.*` public booking). Zod + SuperJSON + React Query. Separate NestJS REST v2 for partners and the Platform SDK. — [Cal.com tRPC wiki](https://factory.ai/open-source-wikis/cal-com?page=api%2Ftrpc.md); [Cal.com architecture](https://factory.ai/open-source-wikis/cal-com?page=overview%2Farchitecture.md)
- Cal.com production incident: a single fat tRPC router on one Vercel function caused **15s cold starts**; splitting routers onto separate API routes dropped a public i18n procedure from 15s to 2s. Remaining per-route cold start 2–3s, mitigated by concurrent browser calls. — [Cal.com Cold Start Resolution](https://cal.com/blog/cal-com-cold-start-resolution-blog)
- tRPC homepage social proof: Theo (t3.gg) "The amount that tRPC has improved the quality of our code..."; Dominik (TkDodo, TanStack Query) "we _are_ starting a production project right now, and we're using @nextjs with @trpcio"; Cory House "more elegant than plain REST or GraphQL when using TS in a monorepo." — [tRPC homepage](https://trpc.io)
- Create T3 App continues to document and optionally scaffold tRPC in 2026-era CLI. — [create-t3-app CLI](https://github.com/t3-oss/create-t3-app/blob/4709861f/cli/src/cli/index.ts); [Create T3 App tRPC docs](https://create.t3.gg/en/usage/trpc)
- Kent C. Dodds: would not investigate tRPC **because Remix already has e2e typesafety**. That is a notable non-adoption, not a departure. — [tRPC homepage](https://trpc.io)
- Community drop-tRPC stories are individual (Server Actions + zsa on Reddit; App Router setup friction), not equivalent to Cal.com-scale writeups. — [r/nextjs](https://www.reddit.com/r/nextjs/comments/1etpoup/trpc_vs_server_actions/)
- T3 maintainers explicitly declined the "replace tRPC with Server Actions" feature request. — [create-t3-app#1456](https://github.com/t3-oss/create-t3-app/issues/1456)

### Inferences

- "Production users" cluster around Next.js + React Query SaaS (Cal.com, T3/Ping-style apps). That is evidence tRPC works at scale **as an internal BFF**, including the operational lesson that huge routers hurt serverless cold starts.
- Absence of a famous "we ripped out tRPC" post should not be read as "everyone stays." Many teams never adopted it (Remix, SvelteKit, public-API companies). Others add REST beside it (Cal.com) which is a partial departure of _scope_, not of the library.
- Do not cite Cal.com as proof tRPC is a good public API. Their own architecture argues the opposite.

### Gaps

- No primary "Documenso / Ping.gg dropped tRPC" source was found in this pass.
- Homepage sponsor/"supported by" logos were not transcribed into a user list.
- GitHub "used by" org list was not scraped.

## Licensing, bundle size, React 19 / RSC future risk

### Takeaway

tRPC is MIT, dependency-light, and still actively patched for React 19. The strategic risk is not license; it is **RSC/Server Actions overlapping tRPC's original job**, plus serverless cold-start cost of fat routers, plus OpenAPI remaining alpha. Bundle size is small either way; oRPC/Hono/Eden are smaller.

### Cited Findings

- License: MIT. README: "zero deps and a tiny client-side footprint." — [trpc/trpc](https://github.com/trpc/trpc/)
- oRPC-measured bundles (min+gzip, tRPC includes SuperJSON, Hono includes `@hono/node-server`): oRPC 14.5 kB, tRPC 23.7 kB, Hono 17.0 kB. — [oRPC Comparison](https://orpc.dev/docs/comparison)
- Kanopy (secondary, different methodology): tRPC client ~12 KB gzip, Hono RPC client ~2 KB, ts-rest ~8 KB. — [Kanopy](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest)
- Eden Treaty: "weighing less than 2KB." — [Elysia Eden](https://elysiajs.com/eden/overview.md)
- React 19: PR to stop infinite proxy recursion when React 19 coerces tRPC proxies via `valueOf`/`toString`/`toJSON`. Description notes downstream apps were carrying `patch-package` across `@11.x` upgrades. — [trpc#7336](https://github.com/trpc/trpc/pull/7336)
- RSC: official TanStack React Query + App Router guide exists, with an explicit warning that RSC may make tRPC unnecessary. Server caller in RSC does **not** populate the client Query cache unless you prefetch/hydrate. — [tRPC + RSC](https://trpc.io/docs/client/tanstack-react-query/server-components)
- Server Actions integration remains `experimental_`. — [tRPC Server Actions](https://trpc.io/docs/client/nextjs/server-actions)
- OpenAPI package is alpha, versioned `11.x.x-alpha`. — [tRPC OpenAPI](https://trpc.io/docs/openapi)
- Cal.com: tRPC router graph size became a Vercel cold-start incident, fixed by splitting handlers so Vercel emits separate functions. — [Cal.com cold starts](https://cal.com/blog/cal-com-cold-start-resolution-blog)
- oRPC offers lazy routers for "code splitting, faster cold starts" as a first-class comparison row. — [oRPC Comparison](https://orpc.dev/docs/comparison)

### Inferences

- License is a non-issue for commercial use.
- Bundle size should not decide between tRPC and oRPC for a normal SPA; it can matter on the edge. SuperJSON is a real chunk of the "tRPC is heavier" comparison.
- Future risk to tRPC is **product overlap with React 19 / Next.js**, not abandonment. Official docs already concede RSC solves "a lot of the same problems." The library is adapting (RSC guide, experimental Actions, React 19 proxy fix) rather than being deprecated.
- Serverless + one mega-router is a documented production risk independent of DX.

### Gaps

- Current npm gzip size of `@trpc/client` alone (without SuperJSON) was not measured in this pass; vendor and blog numbers disagree.
- No official tRPC roadmap statement on RSC making tRPC obsolete.

## Decision matrix and community consensus ("best tRPC stack" vs "don't use tRPC")

### Takeaway

The "best stack that suits using tRPC" is a **TypeScript React (or RN) monorepo** with TanStack Query, Zod, and an internal-only API. That premise is wrong for public API products, multi-framework companies, and idiomatic SvelteKit/Remix shops. oRPC/ts-rest/Hono/Eden are the 2026 typed alternatives when the premise is wrong.

### Cited Findings

- Consensus **for** tRPC: T3 still scaffolds it; maintainers call it the data layer; homepage testimonials from Theo, TkDodo, Cory House; Cal.com uses it for the first-party Next.js app. — [create-t3-app#1456](https://github.com/t3-oss/create-t3-app/issues/1456); [Create T3 App tRPC](https://create.t3.gg/en/usage/trpc); [tRPC homepage](https://trpc.io); [Cal.com tRPC wiki](https://factory.ai/open-source-wikis/cal-com?page=api%2Ftrpc.md)
- Consensus **against** using tRPC as the only API: sidlynx, LogRocket, Kanopy, APIScout, and Cal.com's own dual-stack all say external/non-TS consumers need REST/OpenAPI or GraphQL. — [When tRPC is not enough](https://sidlynx.me/blog/when-trpc-is-not-enough/); [LogRocket](https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/); [Kanopy](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest); [APIScout](https://apiscout.dev/guides/trpc-vs-graphql-vs-rest-2026); [Cal.com architecture](https://factory.ai/open-source-wikis/cal-com?page=overview%2Farchitecture.md)
- "Best tRPC stack" ingredients from T3 + official clients: Next.js (or other TS server adapter) + `AppRouter` type export + Zod + SuperJSON + `@trpc/tanstack-react-query` + `httpBatchLink`. Optional hybrid Server Actions (`experimental_`). CORS if a second TS origin (RN). — [Create T3 App tRPC](https://create.t3.gg/en/usage/trpc); [tRPC vanilla client](https://trpc.io/docs/client/vanilla); [tRPC Server Actions](https://trpc.io/docs/client/nextjs/server-actions)
- LogRocket scenario table (tRPC vs oRPC) and Kanopy scenario list (tRPC vs Hono vs ts-rest) agree on the split: monorepo TS → tRPC; OpenAPI/external → not tRPC. — [LogRocket](https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/); [Kanopy](https://kanopylabs.com/blog/trpc-vs-hono-rpc-vs-ts-rest)

### Inferences

Decision matrix (researcher synthesis from the sources above; not a vendor table):

| Situation                                                           | tRPC fit                  | Prefer instead                                                                     | Why                                                                                            |
| ------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Greenfield TS React app (Next.js or Vite), one team, internal API   | **Strong yes**            | T3-like: tRPC + TanStack Query + Zod                                               | This is the design center. Instant inference, batching, Query cache.                           |
| Greenfield TS React app that will have a public API or partners     | Weak / dual-stack         | oRPC, ts-rest, or tRPC + separate REST                                             | Do not let `AppRouter` become the partner contract. Cal.com pattern if tRPC is already chosen. |
| Public API product (OpenAPI, API keys, SDKs, Postman)               | **No as the product API** | OpenAPI-first REST, ts-rest, oRPC, GraphQL/Pothos                                  | tRPC protocol and alpha OpenAPI are the wrong artifact to sell.                                |
| Multi-framework company (React + Vue + Angular + Java services)     | Poor                      | ts-rest, oRPC, GraphQL, Hono+OpenAPI                                               | tRPC first-class story is React Query; other clients are community or vanilla.                 |
| SvelteKit shop                                                      | Usually mismatch          | SvelteKit `load` + form actions; or Hono/ts-rest if you need a standalone HTTP API | Community adapter lagged at tRPC v10; kit already types the server boundary.                   |
| Remix / React Router framework-mode shop                            | Often unnecessary         | Remix/RR loaders and actions                                                       | Kent's stated reason not to look at tRPC.                                                      |
| React Native **+** web, both TypeScript                             | **Yes**                   | tRPC or oRPC                                                                       | Same `AppRouter`; enable CORS. T3 documents this.                                              |
| React Native + native Swift/Kotlin modules calling the same backend | Dual-stack                | tRPC/oRPC for TS apps + REST/OpenAPI for native                                    | Non-TS clients cannot import the router.                                                       |
| Next.js App Router, mostly RSC, simple forms, one web client        | Optional                  | RSC + Server Actions (+ Zod action lib)                                            | tRPC docs admit overlap; some teams drop tRPC here.                                            |
| Edge/Workers, tiny bundle, real HTTP URLs                           | Weak                      | Hono RPC (or Elysia/Eden on Bun)                                                   | Real routes, smaller runtime, deploy-anywhere.                                                 |
| Contract-first, split FE/BE teams, versioned HTTP                   | No                        | ts-rest or OpenAPI-first                                                           | tRPC is implementation-first; breaking the client is the feature and the cost.                 |
| Need subscriptions / SSE in TS React                                | Yes                       | tRPC or oRPC                                                                       | First-class in tRPC; Hono weaker.                                                              |
| Already on Elysia                                                   | N/A                       | Eden Treaty                                                                        | Framework-native typed RPC.                                                                    |

Product types tRPC is best for (when the "use tRPC" premise is valid):

- Internal SaaS dashboards and admin consoles (Cal.com web app shape)
- Small-to-mid TypeScript product teams shipping web + Expo
- B2B apps with no partner API in year one, **if** leadership accepts adding REST later
- Rapidly iterating monorepos where rename-across-the-stack is more valuable than stable URLs

Product types where the premise is wrong:

- API companies, platforms, marketplaces with third-party developers
- Multi-language orgs
- Framework-native SvelteKit/Remix/Nuxt apps that do not need a second client
- Anything that must speak ordinary REST to mobile, partners, or compliance auditors

### Gaps

- No 2026 survey or GitHub comparison of new T3 apps choosing tRPC vs oRPC vs Server Actions.
- Kanopy's "teams report shipping 20 to 30 percent faster" is marketing language from a consultancy blog and is **not** treated as a finding.
- "Best tRPC stack" beyond T3 (for example Fastify + standalone React SPA + tRPC) is widely possible via adapters but less documented as a canonical recipe.
