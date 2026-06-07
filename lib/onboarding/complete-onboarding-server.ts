"use server";

import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export async function completeOnboarding(name: string): Promise<never> {
  await fetchAuthMutation(api.organizations.mutations.createOrganization, {
    name,
  });
  redirect("/app");
}
