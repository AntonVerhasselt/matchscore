import { PublicNavbar } from "@/components/PublicNavbar";
import { isAuthenticated } from "@/lib/auth-server";

export default async function PublicHeader() {
  const authenticated = await isAuthenticated();

  return <PublicNavbar authenticated={authenticated} />;
}
