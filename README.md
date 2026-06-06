# Matchscore

A [Convex](https://convex.dev/) + [Next.js](https://nextjs.org/) App Router starter with [Better Auth](https://www.better-auth.com/) and [Resend](https://resend.com/) email.

## Stack

- Convex backend (database, queries, mutations)
- Better Auth (email/password sign-up and sign-in)
- Resend component (transactional email, password reset)
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

### Password reset emails

Password reset is wired up end-to-end. By default, Resend runs in **test mode** — emails are only delivered to [Resend test addresses](https://resend.com/docs/dashboard/emails/send-test-emails) (e.g. `delivered@resend.dev`).

To send to real addresses, add a Resend API key and disable test mode:

```bash
npx convex env set RESEND_API_KEY re_xxxxxxxx
npx convex env set RESEND_TEST_MODE false
npx convex env set AUTH_FROM_EMAIL "Matchscore <noreply@yourdomain.com>"
```

The `AUTH_FROM_EMAIL` address must use a domain verified in your [Resend dashboard](https://resend.com/domains).

Transactional emails use **published** Resend templates defined in `convex/emails.ts`. Template variables: `name` + `password_reset_link` (reset), `name` + `verification_link` (verification).

New users must verify their email before signing in. After sign-up, check your inbox for the verification link.

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
| `NEXT_PUBLIC_SITE_URL` | Yes | Public app URL for password-reset redirects |
| `CONVEX_DEPLOY_KEY` | Prod/CI only | Deploy Convex functions during production builds |

### Convex deployment (`npx convex env set`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `BETTER_AUTH_SECRET` | Yes | Secret for Better Auth sessions (`openssl rand -base64 32`) |
| `SITE_URL` | Yes | Base URL for auth callbacks and reset-password links |
| `RESEND_API_KEY` | For real emails | Resend API key |
| `RESEND_TEST_MODE` | No | Set to `false` to send to real addresses (default: test mode) |
| `AUTH_FROM_EMAIL` | No | Sender address for transactional email |
