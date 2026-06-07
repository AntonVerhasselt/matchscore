import { AppShell } from "@/components/app-shell";
import { isAuthenticated } from "@/lib/auth-server";
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

  return <AppShell>{children}</AppShell>;
}
