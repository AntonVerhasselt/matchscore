# Authentication

Matchscore uses [Better Auth](https://www.better-auth.com/) integrated with Convex via [`@convex-dev/better-auth`](https://www.convex.dev/components/better-auth). Sign-in is **email OTP only** — no passwords.

## Architecture

```
Browser (Next.js)
  │
  ├─ authClient (lib/auth-client.ts)          ← client-side auth calls
  ├─ /api/auth/[...all] (lib/auth-server.ts)  ← Better Auth HTTP handler
  │
  └─ ConvexBetterAuthProvider                   ← syncs session token to Convex client
        │
        ▼
Convex
  ├─ HTTP routes (convex/http.ts)               ← Better Auth backend endpoints
  ├─ auth.ts                                    ← Better Auth instance + getCurrentUser
  └─ emailActions.ts                            ← sends OTP emails via Resend
```

Better Auth stores session and user data through the Convex Better Auth component (`components.betterAuth`). App-specific settings (like locale) live in separate tables defined in `convex/schema.ts`.

## Sign-in flow

The sign-in page (`app/(public)/sign-in/page.tsx`) is a two-step flow:

### Step 1 — Request OTP

1. User enters their email address
2. The app saves the current UI locale for that email (`setEmailLocaleForAddress`) so the OTP email is localized
3. `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })` is called
4. Better Auth generates a 6-digit OTP and calls the `sendVerificationOTP` hook in `convex/auth.ts`
5. That hook looks up the email locale and runs `sendOtpEmail`, which renders and sends the email through Resend

### Step 2 — Verify OTP

1. User enters the 6-digit code
2. `authClient.signIn.emailOtp({ email, otp })` verifies the code and creates a session
3. `syncLocaleOnSignIn` reconciles the UI locale cookie with the user’s saved preference in Convex
4. User is redirected to `/app`

Resend and “change email” actions repeat step 1’s locale + send logic.

## Protecting routes

Routes under `/app` are protected by a server layout (`app/app/layout.tsx`):

```ts
const authenticated = await isAuthenticated();
if (!authenticated) {
  redirect("/sign-in");
}
```

`isAuthenticated` comes from `convexBetterAuthNextJs` in `lib/auth-server.ts`. There is no Next.js middleware; protection is layout-based.

Public routes live under `app/(public)/` (home, sign-in) and are accessible without a session.

## Client setup

**Auth client** (`lib/auth-client.ts`):

```ts
createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});
```

**Convex provider** (`components/ConvexClientProvider.tsx`):

- Creates a `ConvexReactClient`
- Wraps children in `ConvexBetterAuthProvider` with `authClient` and an optional `initialToken` from the server

The root layout fetches `initialToken` via `getToken()` so the Convex client is authenticated on first render without a client-side round trip.

## Server setup

**Auth server helpers** (`lib/auth-server.ts`):

Exports from `convexBetterAuthNextJs`:

| Helper | Purpose |
|--------|---------|
| `handler` | Next.js route handler for `/api/auth/*` |
| `isAuthenticated` | Check if the current request has a valid session |
| `getToken` | Get the Convex auth token for SSR |
| `fetchAuthQuery` / `fetchAuthMutation` / `fetchAuthAction` | Run Convex functions with the user’s session |
| `preloadAuthQuery` | Preload authenticated queries in RSC |

**API route** (`app/api/auth/[...all]/route.ts`) re-exports `GET` and `POST` from the handler.

Required environment variables (see `.env.example`):

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js | Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Next.js | Convex `.convex.site` URL for auth HTTP |
| `NEXT_PUBLIC_SITE_URL` | Next.js | Public app URL for redirects |
| `BETTER_AUTH_SECRET` | Convex | Secret for signing sessions (`openssl rand -base64 32`) |
| `SITE_URL` | Convex | Base URL for Better Auth callbacks |
| `RESEND_API_KEY` | Convex | API key for sending emails |
| `RESEND_TEST_MODE` | Convex | `"false"` to deliver to real addresses |
| `AUTH_FROM_EMAIL` | Convex | Sender address (verified domain in Resend) |

## Convex backend

**HTTP router** (`convex/http.ts`):

```ts
authComponent.registerRoutes(http, createAuth);
```

Registers Better Auth’s HTTP endpoints on the Convex deployment.

**Auth instance** (`convex/auth.ts`):

- `createAuth(ctx)` — builds the Better Auth instance with the Convex adapter and plugins:
  - `convex({ authConfig })` — Convex integration
  - `emailOTP({ sendVerificationOTP })` — custom OTP delivery via Resend
- `getCurrentUser` — public query returning the authenticated user or `null` (uses `safeGetAuthUser`, so it never throws for unauthenticated callers)

**Auth config** (`convex/auth.config.ts`):

```ts
{ providers: [getAuthConfigProvider()] }
```

This connects Better Auth’s JWT validation to Convex’s auth system.

## Using auth in the app

**Check current user (client):**

```ts
const user = useQuery(api.auth.getCurrentUser);
// user.email, etc.
```

**Sign out:**

```ts
await authClient.signOut();
router.push("/");
router.refresh();
```

**Run authenticated server actions:**

```ts
import { fetchAuthMutation } from "@/lib/auth-server";

await fetchAuthMutation(api.userSettings.updateUserLocale, { locale: "en" });
```

Convex mutations that require auth (e.g. `updateUserLocale`) use `authComponent.getAuthUser(ctx)`, which throws if unauthenticated.

## Email delivery details

- OTP codes expire after 5 minutes (`OTP_EXPIRES_IN_MINUTES` in `emails/OtpSignInEmail.tsx`)
- Only `type: "sign-in"` OTPs trigger email delivery; other OTP types are ignored
- Emails are sent through `@convex-dev/resend` in test mode by default (`RESEND_TEST_MODE !== "false"`), which restricts delivery to Resend test addresses
- Failures in `sendOtpEmail` are logged and re-thrown

## Key files

| File | Role |
|------|------|
| `lib/auth-client.ts` | Browser-side Better Auth client |
| `lib/auth-server.ts` | Next.js ↔ Convex auth bridge |
| `app/api/auth/[...all]/route.ts` | Auth HTTP API route |
| `components/ConvexClientProvider.tsx` | Convex + auth React context |
| `convex/auth.ts` | Better Auth config, OTP hook, `getCurrentUser` |
| `convex/auth.config.ts` | Convex auth provider config |
| `convex/http.ts` | Registers auth HTTP routes |
| `convex/emailActions.ts` | Sends OTP emails |
| `app/(public)/sign-in/page.tsx` | Sign-in UI |
| `app/app/layout.tsx` | Route protection |
| `app/app/page.tsx` | Example authenticated page with sign-out |
