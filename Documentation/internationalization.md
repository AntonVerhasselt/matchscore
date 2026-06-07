# Internationalization (UI)

Matchscore uses [next-intl](https://next-intl.dev/) for UI translations. The app supports four locales and keeps the chosen language in a cookie, with optional persistence in Convex for signed-in users.

## Supported locales

| Code | Language   | Notes                          |
|------|------------|--------------------------------|
| `nl` | Nederlands | Default locale                 |
| `fr` | Français   |                                |
| `en` | English    | Fallback for unsupported langs |
| `de` | Deutsch    |                                |

Configuration lives in `i18n/config.ts`:

- `locales` — list of supported locale codes
- `defaultLocale` — `nl` (used when no preference is detected)
- `unsupportedFallback` — `en` (used when the browser language cannot be matched)
- `LOCALE_COOKIE_NAME` — `MATCHSCORE_LOCALE`
- `localeLabels` — human-readable names for the settings UI

## Translation files

All UI strings are stored as JSON in the `messages/` directory:

```text
messages/
  nl.json
  fr.json
  en.json
  de.json
```

Messages are grouped by feature namespace, for example:

- `common` — navigation, metadata, shared labels
- `landing` — public homepage
- `signIn` — sign-in flow
- `app` — authenticated app shell
- `settings` — settings page
- `email` — email copy (see [Email internationalization](./email-internationalization.md))

When adding UI text, add the key to **all four** locale files.

## How the active locale is chosen

On each request, `i18n/request.ts` resolves the locale in this order:

1. **Cookie** — if `MATCHSCORE_LOCALE` is set and valid, use it
2. **Browser** — otherwise parse the `Accept-Language` header via `i18n/detect-locale.ts` (using `@formatjs/intl-localematcher` and `negotiator`)
3. **Default** — fall back to `nl`, or `en` if matching fails

The resolved locale and its messages are provided to the app through next-intl’s request config, wired in `next.config.ts`:

```ts
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
```

## Rendering translated UI

The root layout (`app/layout.tsx`) loads the locale and messages on the server and wraps the app in `NextIntlClientProvider`. The `<html lang="...">` attribute is set from the active locale.

**Server components** use next-intl’s server helpers:

```ts
import { getTranslations } from "next-intl/server";

const t = await getTranslations("common.metadata");
```

**Client components** use hooks:

```ts
import { useTranslations, useLocale } from "next-intl";

const t = useTranslations("app");
const locale = useLocale();
```

TypeScript knows the valid locale codes via `global.d.ts`, which extends next-intl’s `AppConfig` with the `Locale` type from `i18n/config.ts`.

## Changing the language

The `LanguageSwitcher` component (`components/LanguageSwitcher.tsx`) is used in the public header (compact dropdown) and on the settings page (full select).

When the user picks a language, it calls the `setLocale` server action (`lib/i18n/set-locale.ts`), which:

1. Validates the locale
2. Sets the `MATCHSCORE_LOCALE` cookie (1-year max age, `path: /`, `sameSite: lax`)
3. If the user is signed in, saves the locale to Convex via `userSettings.updateUserLocale`
4. Triggers a router refresh so the new locale is applied

## Persisting locale for signed-in users

Authenticated users have their locale stored in the Convex `userSettings` table (`convex/userSettings.ts`):

- `getUserLocale` — returns the saved locale for the current user, or `null`
- `updateUserLocale` — creates or updates the user’s locale preference

### Sync on sign-in

After a successful OTP sign-in, `syncLocaleOnSignIn` (`lib/i18n/sync-locale-on-sign-in-server.ts`) reconciles cookie and database:

- If the user **already has** a saved locale → apply it to the cookie (database wins)
- If the user **has no** saved locale → store the current cookie locale in the database

This keeps anonymous browsing language and account preferences aligned without overwriting an existing preference.

## Adding a new locale

1. Add the code to `locales` in `i18n/config.ts` and `localeValidator` in `convex/locales.ts`
2. Create `messages/{code}.json` with all namespaces
3. Add a label to `localeLabels` in `i18n/config.ts`
4. Regenerate Convex types if needed (`npx convex dev`)

## Key files

| File | Role |
|------|------|
| `i18n/config.ts` | Locale list, defaults, cookie name |
| `i18n/request.ts` | Per-request locale + message loading |
| `i18n/detect-locale.ts` | Accept-Language parsing |
| `messages/*.json` | Translation strings |
| `lib/i18n/set-locale.ts` | Server action to change language |
| `lib/i18n/sync-locale-on-sign-in-server.ts` | Post sign-in locale sync |
| `components/LanguageSwitcher.tsx` | Language picker UI |
| `convex/userSettings.ts` | Persisted locale for auth users |
| `app/app/settings/page.tsx` | Settings page with language picker |
