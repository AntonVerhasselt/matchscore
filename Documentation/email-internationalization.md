# Email internationalization

Emails are translated separately from the web UI. They do not use next-intl; the send pipeline loads strings from `messages/{locale}.json` and passes them into the React Email template as props.

## Flow

```text
Sign-in page (current UI locale)
        │
        ▼
setEmailLocaleForAddress  ──►  pendingEmailLocales (keyed by email)
        │
        ▼
Better Auth sends OTP  ──►  getLocaleForEmail  ──►  locale (default: nl)
        │
        ▼
sendOtpEmail  ──►  loadEmailMessages(locale)  ──►  OtpSignInEmail  ──►  Resend
```

### Organisation invitation emails

```text
Member invites email (Settings)
        │
        ▼
inviteMember  ──►  inviter's userSettings.locale
        │
        ▼
sendOrganizationInvitationEmail  ──►  OrganizationInvitationEmail  ──►  Resend
```

## Translation files

Email copy lives under the `email` namespace in each locale file:

```json
{
  "email": {
    "preview": "Your Matchscore sign-in code is {otp}",
    "body": "Use the code below to sign in to your account.",
    "expiresIn": "This code expires in {minutes} minutes.",
    "footer": "If you didn't request this code, you can safely ignore this email.",
    "subject": "{otp} is your Matchscore sign-in code",
    "orgInvitation": {
      "preview": "{inviterName} invited you to join {organizationName}",
      "body": "...",
      "cta": "Accept invitation",
      "expiresIn": "This invitation expires in {days} days.",
      "footer": "...",
      "subject": "Join {organizationName} on Matchscore"
    }
  }
}
```

`lib/i18n/load-email-messages.ts` returns this section for a given locale. Invalid locales fall back to `nl`.

Placeholders like `{otp}` are filled in by `formatMessage` in `lib/i18n/format-message.ts`.

## How the locale is chosen

Emails are sent before the user is signed in, so the app cannot use `userSettings`. Instead:

1. **Before sending the OTP**, the sign-in page stores the current UI locale for that email:

```ts
await setEmailLocale(email);
await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
```

2. **When Better Auth sends the email**, `convex/auth/instance.ts` looks up `pendingEmailLocales` via `internal.users.emailLocales.getLocaleForEmail`. If no row exists, it uses `nl`.

3. **`internal.emails.actions.sendOtpEmail`** loads the messages and renders the template.

### Invitation email locale

Organization invitation emails use the **inviter's** saved locale from `userSettings` (set in `organizations/mutations.ts` → `inviteMember`). The invitee's UI locale before sign-in does not affect the invitation email.

The same `setEmailLocale` call runs on resend, so the email matches the language shown in the UI at that moment.

## UI locale sync (separate concern)

After sign-in, `syncLocaleOnSignIn` syncs the UI locale to `userSettings` for cross-device use. That does not affect which language the OTP email was sent in.

## Dev preview

`/dev/emails/[slug]` renders with `loadEmailMessages`, using the `MATCHSCORE_LOCALE` cookie (or `nl`).

## Adding a new email

1. Add strings to `messages/*.json`
2. Update `EmailMessages` in `load-email-messages.ts` if needed
3. Pass `messages` as a prop to the React Email component
4. Register the template in `emails/registry.ts`
