# Matchscore

A [Convex](https://convex.dev/) + [Next.js](https://nextjs.org/) App Router starter with [Better Auth](https://www.better-auth.com/) and [Resend](https://resend.com/) email.

## Stack

- Convex backend (database, queries, mutations)
- Better Auth (passwordless email OTP sign-in)
- Resend component (transactional email delivery)
- React Email (email templates in-repo)
- Next.js App Router frontend
- Tailwind CSS
- pnpm package manager

## Local development

1. Log into your **personal** Convex account (`pnpm exec convex logout` then `pnpm exec convex login` if needed).
2. Install dependencies:

```bash
pnpm install
```

3. Copy the environment template and start the dev servers:

```bash
cp .env.example .env.local
pnpm run dev
```

On first run, create a new Convex project named `matchscore` under your personal team. This writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local`.

4. Set required Convex backend environment variables:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
```

5. Open [http://localhost:3000](http://localhost:3000).

### Reset dev database

To wipe users, organisations, and auth data from your **dev** deployment (keeps imported `footballTeams`):

```bash
pnpm run db:clear-dev
```

This runs `dev/clearDatabase:clearAll` — clears app testing data and auth, but **preserves the VoetbalInBelgië club import**. Safe for local testing, not for production.

### Sign-in with email OTP

Sign-in is passwordless. Enter your email on `/sign-in`, receive a 6-digit code, and enter it to sign in. New users are created automatically on first sign-in, then complete club setup on `/onboarding`.

### Organisations

Each user belongs to one club (organisation). New users create their club on onboarding. Existing members can invite colleagues from **Settings → Club members**. See [Documentation/organisations.md](Documentation/organisations.md).

### Football data (VoetbalInBelgië)

Club/team records for onboarding search are imported from VoetbalInBelgië. At the **start of each season**, run the full import runbook:

- **[Documentation/football-season-import.md](Documentation/football-season-import.md)** — checklist, commands, validation
- Quick command (dev): `pnpm import:football-clubs:full`

By default, Resend runs in **test mode** — emails are only delivered to [Resend test addresses](https://resend.com/docs/dashboard/emails/send-test-emails) (e.g. `delivered@resend.dev`).

To send to real addresses, add a Resend API key and disable test mode:

```bash
npx convex env set RESEND_API_KEY re_xxxxxxxx
npx convex env set RESEND_TEST_MODE false
npx convex env set AUTH_FROM_EMAIL "Matchscore <noreply@yourdomain.com>"
```

The `AUTH_FROM_EMAIL` address must use a domain verified in your [Resend dashboard](https://resend.com/domains).

OTP and invitation emails are React Email components in `emails/`, registered in `emails/registry.ts`, rendered to HTML via `lib/emails/render.ts`, and sent via `convex/emails/actions.ts`.

To add a new email: create a component in `emails/`, export it with `defineEmailTemplate()` (subject + `{{variable}}` preview props), and add it to `emails/registry.ts`. Preview routes are automatic at `/dev/emails/[slug]`.

### Email template previews (dev only)

While the dev server is running, preview templates in the browser:

- [http://localhost:3000/dev/emails](http://localhost:3000/dev/emails) — template index
- [http://localhost:3000/dev/emails/otp-sign-in](http://localhost:3000/dev/emails/otp-sign-in) — OTP sign-in email
- [http://localhost:3000/dev/emails/org-invitation](http://localhost:3000/dev/emails/org-invitation) — club invitation email

## Production build

```bash
pnpm run build
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variables (see table below).
4. Set `CONVEX_DEPLOY_KEY` (production deploy key from the Convex dashboard).
5. The build command is already configured in `vercel.json`:

```bash
npx convex deploy --cmd 'pnpm run build'
```

Also set Convex production env vars (`BETTER_AUTH_SECRET`, `SITE_URL`, `RESEND_API_KEY`, etc.) on your production deployment via the Convex dashboard or `npx convex env set --prod`.

## Environment variables

See [`.env.example`](.env.example) for a copy-paste template.

### Next.js (`.env.local` / Vercel)

| Variable | Required | Purpose |
|----------|----------|---------|
| `CONVEX_DEPLOYMENT` | Dev only | Convex deployment name (set by `npx convex dev`) |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL for the frontend |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Yes | Convex site URL (`.convex.site`) for auth HTTP routes |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public app URL for auth redirects |
| `CONVEX_DEPLOY_KEY` | Prod/CI only | Deploy Convex functions during production builds |

### Convex deployment (`npx convex env set`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `BETTER_AUTH_SECRET` | Yes | Secret for Better Auth sessions (`openssl rand -base64 32`) |
| `SITE_URL` | Yes | Base URL for auth callbacks |
| `RESEND_API_KEY` | For real emails | Resend API key |
| `RESEND_TEST_MODE` | No | Set to `false` to send to real addresses (default: test mode) |
| `AUTH_FROM_EMAIL` | No | Sender address for transactional email |
| `VOETBALINBELGIE_API_KEY` | For football sync/import | VoetbalInBelgië competition API key — required for import validation and sync |

See [Documentation/football-season-import.md](Documentation/football-season-import.md) for the seasonal club import runbook.
