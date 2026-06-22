import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/sign-in");
  }

  const hasOrganization = await fetchAuthQuery(
    api.organizations.queries.hasOrganization,
    {},
  );
  if (!hasOrganization) {
    redirect("/onboarding");
  }

  const needsBillingOnboarding = await fetchAuthQuery(
    api.billing.queries.needsBillingOnboarding,
    {},
  );
  const headerList = await headers();
  const isCheckoutSuccessReturn =
    headerList.get("x-matchscore-checkout-success") === "1";
  if (needsBillingOnboarding && !isCheckoutSuccessReturn) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
