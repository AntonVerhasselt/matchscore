<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

Matchscore is a single **Convex + Next.js** app. One `pnpm run dev` starts both the Convex watcher and Next.js on http://localhost:3000.

### Local Convex (no account required)

Cloud agents can use Convex's **anonymous local deployment** without `convex login`:

```bash
pnpm exec convex dev --once   # provisions http://127.0.0.1:3210, writes .env.local
```

On first provision, set backend auth env vars (once per anonymous deployment):

```bash
pnpm exec convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
pnpm exec convex env set SITE_URL http://localhost:3000
```

Resend runs in test mode by default. For sign-in E2E, use `delivered@resend.dev` on `/sign-in`.

### Dev server

Run in a **tmux** session (long-running): `pnpm run dev`. Convex dashboard for local dev: http://127.0.0.1:6790

### Lint / build

See `package.json`: `pnpm run lint`, `pnpm run build`. There is no test runner configured.

### Cloud Convex (optional)

To use a personal Convex cloud project instead of anonymous local, run `pnpm exec convex login` and follow `README.md`.
