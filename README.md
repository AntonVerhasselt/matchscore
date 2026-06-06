# Matchscore

A [Convex](https://convex.dev/) + [Next.js](https://nextjs.org/) App Router starter.

## Stack

- Convex backend (database, queries, mutations)
- Next.js App Router frontend
- Tailwind CSS
- pnpm package manager

## Local development

1. Log into your **personal** Convex account (`pnpm exec convex logout` then `pnpm exec convex login` if needed).
2. Install dependencies:

```bash
pnpm install
```

3. Start Convex and Next.js together:

```bash
pnpm run dev
```

On first run, create a new Convex project named `matchscore` under your personal team. This writes `.env.local` with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`.

4. Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
pnpm run build
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set `CONVEX_DEPLOY_KEY` (production deploy key from the Convex dashboard).
4. The build command is already configured in `vercel.json`:

```bash
npx convex deploy --cmd 'pnpm run build'
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (dev) / Vercel (prod) | Convex deployment URL for the frontend |
| `CONVEX_DEPLOYMENT` | `.env.local` | Dev deployment name for the Convex CLI |
| `CONVEX_DEPLOY_KEY` | Vercel only | Deploy Convex functions during production builds |
