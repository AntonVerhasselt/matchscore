import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Set it in .env.local for development or in your hosting provider for production.",
    );
  }
  return value;
}

const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL");
const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});
