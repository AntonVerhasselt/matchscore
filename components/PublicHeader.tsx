import { PublicNavbar } from "@/components/PublicNavbar";
import { isAuthenticated } from "@/lib/auth-server";

type PublicHeaderProps = {
  theme?: "default" | "brand";
};

export default async function PublicHeader({
  theme = "default",
}: PublicHeaderProps) {
  const authenticated = await isAuthenticated();

  return <PublicNavbar authenticated={authenticated} theme={theme} />;
}
