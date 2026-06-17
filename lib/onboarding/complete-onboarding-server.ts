"use server";

import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export async function completeOnboarding(
  footballTeamId: Id<"footballTeams">,
): Promise<never> {
  await fetchAuthMutation(api.organizations.mutations.createOrganization, {
    footballTeamId,
  });
  redirect("/app");
}
