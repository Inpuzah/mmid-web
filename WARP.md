# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

All commands below assume the working directory is the repo root (`mmid-web`). Package management is via `npm` (a `package-lock.json` is present).

### Install & dev server

- Install dependencies:
  - `npm install`
- Run the Next.js dev server (App Router):
  - `npm run dev`

The main entry route is `src/app/page.tsx`; the app is served on `http://localhost:3000` by default.

### Build & run in production

- Build (runs Prisma generate + migrations + Next.js build):
  - `npm run build`
    - This executes: `prisma generate && prisma migrate deploy && next build`.
    - Requires `DATABASE_URL` and other Prisma-related env vars to be configured.
- Start production server on port 3000:
  - `npm run start`

### Linting

- Run ESLint over the project:
  - `npm run lint`

Note: `next.config.mjs` configures `eslint.ignoreDuringBuilds = true`, so `next build` will not fail on lint errors; use `npm run lint` explicitly to surface them.

### Data sync from Google Sheets (directory import)

This project maintains the MMID directory in a Google Sheet and syncs it into the `MmidEntry` table via Prisma.

- One-off local sync script (Node CJS):
  - `node src/scripts/sync.cjs`
  - Expects:
    - `.env` with `SHEET_ID` and database connection envs (e.g. `DATABASE_URL`).
    - A service account key at `credentials/mmid-service-account.json`.
- There is also a server-side sync path used in production:
  - `src/lib/sync.ts` implements `runSync()` using `GOOGLE_SERVICE_ACCOUNT_JSON` and `SHEET_ID` / `SHEET_TAB` env vars.
  - `src/app/api/cron/sync/route.ts` wires this to an HTTP endpoint used for cron-based sync.

### Tests

There is currently no test runner or `test` script defined in `package.json`. If you add tests, also add the appropriate npm scripts so future agents can run them (e.g. `npm test`, `npm run test:unit`, etc.).

## Architecture overview

### Stack

- **Framework**: Next.js App Router (see `src/app`).
- **Language**: TypeScript with `@/*` path alias mapped to `src/*` (see `tsconfig.json`).
- **Database / ORM**: PostgreSQL via Prisma (`prisma/schema.prisma`).
- **Auth**: `next-auth` with a Prisma adapter and Discord as the login provider (`src/auth.ts`).
- **Styling/UI**: Tailwind CSS (v4) and a small headless UI kit under `src/components/ui` plus Radix UI primitives.

### Domain model (Prisma)

The Prisma schema in `prisma/schema.prisma` defines the core backend data model:

- `MmidEntry`: the main MMID directory entry, keyed by `uuid`. Contains username, guild, status, rank, types of cheating (`String[]`), red flags (`String[]`), notes/evidence, reviewer, confidence score, `nameMcLink`, timestamps, and autosync metadata (`autoSyncedAt`, `autoSyncError`).
- `MmidEntryProposal`: stores proposed changes to entries with `ProposalAction` (`CREATE`/`UPDATE`/`DELETE`) and `ProposalStatus` (`PENDING`/`APPROVED`/`REJECTED`). Links to the target `MmidEntry` and to `User` records for proposer and reviewer, and drives the review workflow.
- `AuditLog`: generic audit log for admin-only visibility; tracks actions like proposal creation/approval/rejection, entry changes, user role changes, and auth sign-ins.
- `User`, `Account`, `Session`, `VerificationToken`: standard NextAuth models, extended with a `role` enum (`USER`, `MAINTAINER`, `ADMIN`) and `discordId` for Discord linkage.
- `JobLock`: simple key-based lock table used for cron job safety.

Most server-side features (directory view, proposals, admin tools, cron jobs) read/write via Prisma using this schema.

### Routing & pages (App Router)

The Next.js app router lives under `src/app`:

- `src/app/layout.tsx` defines the root layout, applies Geist fonts, global styles (`src/app/globals.css`), and renders the `SiteHeader`. It also sets `metadataBase` based on `NEXT_PUBLIC_SITE_URL`, then `NEXTAUTH_URL`, then `http://localhost:3000`.
- `src/app/page.tsx` is the public landing page, featuring project copy, staff/contributor lists, FAQ, and CTAs into the directory and Discord.
- `src/app/directory/page.tsx` is the main directory view:
  - Reads search params (`q`, `status`, `notice`), constructs a Prisma `where` filter, and fetches `MmidEntry` records ordered by username.
  - Maps results into a `MmidRow` shape consumed by `MMIDFullWidthCardList` under `src/app/directory/_components`.
  - Uses `FlashNotice` for top-of-page notifications.
- `src/app/entries/new/*` contains the new-entry submission flow (form components, captcha, actions) for proposing additions/changes to the directory.
- `src/app/admin/*` contains admin/maintainer-only pages:
  - `src/app/admin/page.tsx`: admin dashboard showing counts of pending proposals, directory entries, and users, with navigation into audit logs and duplicate-finding tools.
  - `src/app/admin/proposals/page.tsx`: main review UI for `MmidEntryProposal`:
    - Uses `getServerSession` with `authOptions` to ensure the user is `ADMIN` or `MAINTAINER` before proceeding.
    - Fetches pending proposals with related proposer/user/target data via Prisma.
    - Normalizes current vs proposed entry data into comparable shapes and renders a side-by-side field diff table.
    - Submits approve/reject actions via server actions in `./page.actions.ts`.
  - Other admin routes include `audit` (audit log), `sync` (sync control), `tools/duplicates` (duplicate detection), and `users` (user role/views).
- `src/app/login/page.tsx` implements the login experience (backed by NextAuth Discord provider).
- `src/app/403/page.tsx` is the access-denied page used by middleware redirects.
- API routes under `src/app/api`:
  - `src/app/api/auth/[...nextauth]/route.ts` exposes NextAuth endpoints using `authOptions`.
  - `src/app/api/sync/route.ts` and `src/app/api/cron/sync/route.ts` handle directory synchronization endpoints (manual and cron), delegating to `src/lib/sync.ts`.

### Auth & authorization

#### Roles and capabilities

At a high level:

- `USER`
  - Can view public pages and the directory.
  - Can submit new entries / edits via `/entries/new`, which creates `MmidEntryProposal` records (pending review) after passing hCaptcha.
  - Cannot directly mutate `MmidEntry` rows or access `/admin` or `/maintainer` routes.
- `MAINTAINER`
  - Inherits USER capabilities.
  - Can review and approve/reject proposals via `/admin/proposals` and related server actions.
  - Can trigger manual directory sync (`/admin/sync` and `src/app/api/sync/route.ts`) and use other non–user-management admin tools.
  - Cannot change other users’ roles.
- `ADMIN`
  - Inherits MAINTAINER capabilities.
  - Can manage user roles via `/admin/users`.
  - Can export and inspect the audit log (`/admin/audit`, `/admin/audit/export`).

- **NextAuth configuration** (`src/auth.ts`):
  - Uses `PrismaAdapter(prisma)` and a single `DiscordProvider`.
  - Requires env vars: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`.
  - Session callback attaches `role` and `id` onto `session.user` for easy server/client checks.
  - Events:
    - `signIn`: if `OWNER_EMAIL` env matches the signing-in user’s email, their `role` is promoted to `ADMIN` in Prisma.
    - `linkAccount`: when linking a Discord account, persists `discordId` on the `User` record.
- **Role helpers** (`src/lib/authz.ts`):
  - `requireSession()` ensures there is a logged-in session, throwing an error with HTTP-style status code 401 on failure.
  - `requireRole(allowed: Role[])` checks `session.user.role` and throws 403 if not allowed.
  - `requireAdmin()` and `requireMaintainer()` wrap `requireRole` for common role-gating patterns; used throughout admin routes.
- **Middleware gating** (`src/middleware.ts`):
  - Activates for `/admin`, `/maintainer`, `/api/admin`, and `/api/maintainer` paths (see `config.matcher`).
  - Reads the NextAuth JWT via `getToken` using `NEXTAUTH_SECRET`.
  - If no token is present, redirects to `/login` with `callbackUrl` and `reason=signin_required`.
  - If a token is present but the user’s `role` is not permitted for the matched prefix, redirects to `/403` with `reason=insufficient_role`.
### Data sync pipeline (Google Sheets → Prisma)

There are two main entry points for synchronizing the Google Sheet into the database:

- **Server-side sync (manual + API)** (`src/lib/directory-sync.ts` + `src/lib/sync.ts` + `src/app/api/sync/route.ts` + `src/app/admin/sync/*`):
  - `syncDirectoryFromSheet(mode)` is the core implementation that reads the `Directory` sheet via a service-account credential (`GOOGLE_SERVICE_ACCOUNT_JSON` env) using `src/lib/google-sheets.ts`.
  - Accepts a `mode` of `"upsert"` (non-destructive) or `"rebuild"` (truncate then re-import).
  - `/api/sync` calls `runSync()` in `src/lib/sync.ts`, which delegates to `syncDirectoryFromSheet("upsert")` and returns a JSON summary.
  - The admin page `/admin/sync` calls `syncMmidFromSheet()` (server action) which uses `syncDirectoryFromSheet("rebuild")` and then revalidates the `/directory` route.
- **Local script sync** (`src/scripts/sync.cjs`):
  - Older Node script that uses a `.env`-configured `SHEET_ID` and a key file on disk (`credentials/mmid-service-account.json`) instead of JSON from env.
  - Logs created/updated/skipped counts and exits with non-zero status on failure. It is not used by the Next.js app but can be helpful for one-off imports.

### Components & UI
### Components & UI

- `src/components/MinecraftSkin.tsx` and related components render player skins/poses using `skinview3d` to power the visual experience on the landing/staff pages.
- `src/components/ui/*` contains small, composable UI primitives (buttons, cards, dialogs, dropdown menus, inputs, etc.) built on top of Tailwind and Radix UI.
- `src/components/site-header.tsx` and `src/components/site-header.client.tsx` implement the global header:
  - Server component fetches the session via `getServerSession(authOptions)`.
  - Passes user info (including role) into a client component that renders navigation and auth controls.
- `src/components/flash-notice.tsx` is a small banner component used for notice messaging, especially on the directory page.

### Miscellaneous

- **Path aliasing**: `tsconfig.json` defines `@/*` → `src/*`, so future agents should respect this convention when importing.
- **Next config**: there are both `next.config.mjs` and `next.config.ts` present; the active configuration uses `next.config.mjs` to mark `googleapis` as a `serverExternalPackages` dependency and to disable build-time ESLint failures.
- **Middleware/edge**: `src/middleware.ts` runs at the edge for certain routes; avoid using Node-only APIs there.

If you add new commands or restructure the app (e.g. move routes out of `src/app` or introduce tests), update this file so future Warp agents have an accurate picture of how to work with this codebase.