import { isAuthenticated } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
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
  if (hasOrganization) {
    const needsBillingOnboarding = await fetchAuthQuery(
      api.billing.queries.needsBillingOnboarding,
      {},
    );
    if (!needsBillingOnboarding) {
      redirect("/app");
    }
  }

  return <div className="flex min-h-svh flex-col">{children}</div>;
}
