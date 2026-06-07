# Authentication

Matchscore uses [Better Auth](https://www.better-auth.com/) integrated with Convex via [`@convex-dev/better-auth`](https://www.convex.dev/components/better-auth). Sign-in is **email OTP only** — no passwords.

## Architecture

```text
Browser (Next.js)
  │
  ├─ authClient (lib/auth-client.ts)          ← client-side auth calls
  ├─ /api/auth/[...all] (lib/auth-server.ts)  ← Better Auth HTTP handler
  │
  └─ ConvexBetterAuthProvider                   ← syncs session token to Convex client
        │
        ▼
Convex
  ├─ HTTP routes (convex/http.ts)                    ← Better Auth backend endpoints
  ├─ auth/instance.ts                                ← Better Auth instance
  ├─ auth/queries.ts                                 ← getCurrentUser
  ├─ users/emailLocales.ts                           ← pre-auth email locale
  └─ emails/actions.ts                               ← OTP and invitation emails
```

Better Auth stores session and user data through the Convex Better Auth component (`components.betterAuth`). App-specific data (locale, organisations) lives in separate tables in `convex/schema.ts`.

See also [Organisations](organisations.md) and [Convex structure](convex-structure.md).

## Sign-in flow

The sign-in page (`app/(auth)/sign-in/page.tsx`) is a two-step flow:

### Step 1 — Request OTP

1. User enters their email address
2. The app saves the current UI locale for that email (`api.users.emailLocales.setEmailLocaleForAddress`)
3. `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })` is called
4. Better Auth generates a 6-digit OTP and calls the `sendVerificationOTP` hook in `convex/auth/instance.ts`
5. That hook looks up the email locale and runs `internal.emails.actions.sendOtpEmail`

### Step 2 — Verify OTP

1. User enters the 6-digit code
2. `authClient.signIn.emailOtp({ email, otp })` verifies the code and creates a session
3. `syncLocaleOnSignIn` reconciles the UI locale cookie with the user's saved preference
4. Post-sign-in redirect (`lib/auth/post-sign-in-redirect-server.ts`):
   - If invitation token stored → `acceptInvitation` → `/app`
   - Else if pending invite for email → auto-accept → `/app`
   - Else if no organisation → `/onboarding`
   - Else → `/app`

### Invitation sign-in

When signing in from an invitation:

1. User opens `/accept-invitation/{token}` (token stored in `sessionStorage`)
2. User continues to `/sign-in` and completes OTP with the invited email
3. After OTP, `resolvePostSignInRedirect` accepts the invitation and sends the user to `/app`

## Protecting routes

| Route | Guard |
|-------|-------|
| `/app/*` | Authenticated + has organisation → else `/sign-in` or `/onboarding` |
| `/onboarding` | Authenticated + no organisation → else `/sign-in` or `/app` |
| `/sign-in`, `/`, `/accept-invitation/*` | Public |

`isAuthenticated` and `fetchAuthQuery` come from `convexBetterAuthNextJs` in `lib/auth-server.ts`. There is no Next.js middleware; protection is layout-based.

## Client setup

**Auth client** (`lib/auth-client.ts`):

```ts
createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});
```

**Check current user (client):**

```ts
const user = useQuery(api.auth.queries.getCurrentUser);
```

**Sign out:**

```ts
await authClient.signOut();
router.push("/");
router.refresh();
```

## Server setup

**Auth server helpers** (`lib/auth-server.ts`):

| Helper | Purpose |
|--------|---------|
| `handler` | Next.js route handler for `/api/auth/*` |
| `isAuthenticated` | Check if the current request has a valid session |
| `getToken` | Get the Convex auth token for SSR |
| `fetchAuthQuery` / `fetchAuthMutation` / `fetchAuthAction` | Run Convex functions with the user's session |

**Run authenticated server actions:**

```ts
await fetchAuthMutation(api.users.settings.updateUserLocale, { locale: "en" });
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js | Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Next.js | Convex `.convex.site` URL for auth HTTP |
| `NEXT_PUBLIC_SITE_URL` | Next.js | Public app URL for redirects |
| `BETTER_AUTH_SECRET` | Convex | Secret for signing sessions |
| `SITE_URL` | Convex | Base URL for Better Auth callbacks and invitation links |
| `RESEND_API_KEY` | Convex | API key for sending emails |
| `RESEND_TEST_MODE` | Convex | `"false"` to deliver to real addresses |
| `AUTH_FROM_EMAIL` | Convex | Sender address (verified domain in Resend) |

## Key files

| File | Role |
|------|------|
| `lib/auth-client.ts` | Browser-side Better Auth client |
| `lib/auth-server.ts` | Next.js ↔ Convex auth bridge |
| `lib/auth/post-sign-in-redirect-server.ts` | Post-sign-in routing logic |
| `lib/auth/invitation-token.ts` | Invitation token sessionStorage helpers |
| `app/api/auth/[...all]/route.ts` | Auth HTTP API route |
| `components/ConvexClientProvider.tsx` | Convex + auth React context |
| `convex/auth/instance.ts` | Better Auth config and OTP hook |
| `convex/auth/queries.ts` | `getCurrentUser` |
| `convex/auth/deleteUserAccount.ts` | Internal user account deletion |
| `convex/http.ts` | Registers auth HTTP routes |
| `convex/emails/actions.ts` | Sends OTP and invitation emails |
| `app/(auth)/sign-in/page.tsx` | Sign-in UI |
| `app/onboarding/page.tsx` | Club setup for new users |
| `app/app/layout.tsx` | Auth + organisation route protection |
