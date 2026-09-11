<img src="./static/icon-512.png" alt="Kame Lends logo" width="88" />

# Kame Lends

**A web app for lending teams to manage loans, investors, and cashflow in one place.**

Built with **SvelteKit 2** and **Svelte 5** for day-to-day operations: recording Lot Title / OR/CR / Agent loans, tracking investor participation, interest periods, and collections. Hosted on **Vercel**, backed by **Neon** Postgres, with **Google sign-in** and optional **Google Calendar** sync for disbursements, due dates, and daily summaries.

<p align="center">
  <img src="./docs/screenshots/landing-hero.png" alt="Kame Lends marketing landing page" width="900" />
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#getting-started">Getting Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SvelteKit-2-ff3e00?style=flat-square&logo=svelte" alt="SvelteKit" />
  <img src="https://img.shields.io/badge/Svelte-5-ff3e00?style=flat-square&logo=svelte" alt="Svelte" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-000?style=flat-square" alt="Drizzle" />
  <img src="https://img.shields.io/badge/Neon-Postgres-00e599?style=flat-square&logo=neon" alt="Neon" />
  <img src="https://img.shields.io/badge/Vercel-000?style=flat-square&logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/Google-OAuth-4285F4?style=flat-square&logo=google" alt="Google OAuth" />
  <img src="https://img.shields.io/badge/Google-Calendar-4285F4?style=flat-square&logo=googlecalendar" alt="Google Calendar" />
</p>

---

## Features

### Loans

- Create and manage **Lot Title**, **OR/CR**, and **Agent** loans
- Multi-investor allocation with per-investor principal, rates, and schedules
- **Multiple interest periods**, received payments, and overdue handling
- In-app calendar, table, and card views with filters and sorting
- Duplicate loans, PDF/CSV export, and manual Google Calendar sync from settings

### Investors

- Investor directory with capital, returns, and active loan counts
- **Investor portal**: share loans via investor email (Google sign-in)
- Role-based access (`admin` vs `investor`)

### Transactions & dashboard

- Transaction ledger (collections, disbursements, returns)
- Dashboard with summary metrics, cashflow charts, and activity cards
- Past due, maturing, pending disbursement, and completed loan panels
- **Privacy toggle** to hide sensitive data (names, amounts, dates, rates, counts) across the app

### Google sign-in (OAuth)

- **Sign in with Google** via [Auth.js](https://authjs.dev/) (`@auth/sveltekit`). No passwords stored in the app
- Sessions persisted with the Drizzle adapter (`users`, `accounts`, `sessions`)
- **Role-based access**: `admin` (full workspace) and `investor` (shared loans & transactions)
- **Investor portal**: link investors by email so they sign in with the same Google account and see assigned loans

### Google Calendar integration

Optional sync powered by a **Google Cloud service account** and the Calendar API (`googleapis`):

- **Disbursement events** on principal sent dates, with investor breakdown
- **Due date events** with principal and interest totals
- **Interest due events** for loans with multiple interest periods
- **Daily summary events** aggregating in/out flows per day, with links back to filtered loans in the app
- **Manual sync** from the app (bulk sync / cleanup). Calendar updates are not forced on every loan save
- Investor emails can be added as attendees on events (when configured)

Requires `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, and `GOOGLE_CALENDAR_ID` in `.env.example`.

### Operations & data

- JSON backup download and optional daily email backups (Resend + cron)
- Maintenance tools: sync due dates, fix received-payment totals

---

## Screenshots

|                       Landing                        |                  Sign in                   |
| :--------------------------------------------------: | :----------------------------------------: |
| ![Landing page](./docs/screenshots/landing-hero.png) | ![Sign in](./docs/screenshots/sign-in.png) |

### App previews

Screenshots from the live app. Several views show the **privacy toggle** (eye icon) hiding names, amounts, dates, and rates.

|                   Dashboard                    |                Loans (table)                 |
| :--------------------------------------------: | :------------------------------------------: |
| ![Dashboard](./docs/screenshots/dashboard.png) | ![Loans table](./docs/screenshots/loans.png) |

|                     Loans (calendar)                     |                       Loan detail                        |
| :------------------------------------------------------: | :------------------------------------------------------: |
| ![Loans calendar](./docs/screenshots/loans-calendar.png) | ![Loan detail modal](./docs/screenshots/loan-detail.png) |

|                    Create loan                     |                   Investors                    |
| :------------------------------------------------: | :--------------------------------------------: |
| ![Create loan](./docs/screenshots/loan-create.png) | ![Investors](./docs/screenshots/investors.png) |

|                     Transactions                     |
| :--------------------------------------------------: |
| ![Transactions](./docs/screenshots/transactions.png) |

---

## Tech Stack

| Layer              | Technology                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/)                                                                                                                            |
| UI                 | [Tailwind CSS 4](https://tailwindcss.com/), [shadcn-svelte](https://www.shadcn-svelte.com/)                                                                                                             |
| **Authentication** | [Auth.js](https://authjs.dev/) (`@auth/sveltekit`) + **Google OAuth** ([`src/lib/server/auth.ts`](./src/lib/server/auth.ts))                                                                            |
| **Calendar**       | [Google Calendar API](https://developers.google.com/calendar) via [`googleapis`](https://www.npmjs.com/package/googleapis) ([`src/lib/server/google-calendar.ts`](./src/lib/server/google-calendar.ts)) |
| **Database**       | [Neon](https://neon.tech/) PostgreSQL + [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless)                                                                            |
| **Hosting**        | [Vercel](https://vercel.com/) (`@sveltejs/adapter-vercel`)                                                                                                                                              |
| ORM                | [Drizzle ORM](https://orm.drizzle.team/)                                                                                                                                                                |
| Forms              | sveltekit-superforms + Zod                                                                                                                                                                              |
| Charts             | SVG donuts and CSS ranking tracks; ApexCharts only for cashflow.                                                                                                                                        |
| PDF export         | `@react-pdf/renderer` (server-only)                                                                                                                                                                     |
| Email (optional)   | Resend                                                                                                                                                                                                  |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- A [Neon](https://neon.tech) PostgreSQL database (or local Docker Postgres)
- [Google Cloud](https://console.cloud.google.com/) project with:
  - **OAuth 2.0** credentials (Web application) for sign-in
  - **Calendar API** enabled + **service account** (optional, for calendar sync)

### 1. Clone and install

```bash
git clone https://github.com/sprmke/pawn-tracker.git
cd pawn-tracker
bun install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in at minimum:

| Variable             | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`       | Neon connection string (`?sslmode=require`), or local Docker URL |
| `AUTH_SECRET`        | Random secret: `openssl rand -base64 32`                         |
| `AUTH_GOOGLE_ID`     | Google OAuth client ID                                           |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret                                       |

**Google Calendar (optional)**

| Variable                             | Description                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Service account email from Google Cloud              |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account private key (JSON key file)          |
| `GOOGLE_CALENDAR_ID`                 | Target calendar ID (`primary` or shared calendar ID) |
| `PUBLIC_APP_URL`                     | App URL for links inside calendar event descriptions |

**Other optional:** backups (`RESEND_API_KEY`, `BACKUP_EMAIL`, `CRON_SECRET`). See `.env.example` for the full list.

### 3. Database

For local Docker Postgres:

```bash
bun run db:local:start
bun run db:local:push
```

For Neon, use `bun run db:migrate` against a non-prod branch. Do not run `db:push` against production without the **lendwave** unlock.

If you upgrade an older database and see missing column errors, run `db/migrations/0001_interest_incomplete_and_period_link.sql` in the Neon SQL editor (see comments in that file for Postgres version notes).

### 4. Run locally

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in with Google to access the dashboard.

---

## Scripts

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `bun run dev`            | Vite / SvelteKit development server |
| `bun run build`          | Production build                    |
| `bun run preview`        | Preview the production build        |
| `bun run check`          | svelte-check                        |
| `bun run test`           | Vitest unit tests                   |
| `bun run db:local:start` | Start Docker Postgres               |
| `bun run db:local:push`  | Push schema to local Postgres only  |
| `bun run db:generate`    | Generate Drizzle migrations         |
| `bun run db:migrate`     | Run migrations                      |
| `bun run db:studio`      | Open Drizzle Studio                 |

---

## Project structure

```text
src/routes/          # SvelteKit pages and API (+server.ts)
src/lib/             # Domain logic, components, composables
src/lib/server/      # DB, auth, calendar, access-control, PDF
db/migrations/       # Shipped SQL patches (do not edit)
docs/                # Architecture, route guides, workflow
scripts/             # Backup, AI tooling, local DB
```
