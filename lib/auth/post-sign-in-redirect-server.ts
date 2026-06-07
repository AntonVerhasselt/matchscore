"use server";

import { api } from "@/convex/_generated/api";
import {
  fetchAuthMutation,
  fetchAuthQuery,
} from "@/lib/auth-server";

export async function resolvePostSignInRedirect(
  invitationToken?: string,
): Promise<"/app" | "/onboarding"> {
  if (invitationToken) {
    await fetchAuthMutation(api.organizations.mutations.acceptInvitation, {
      token: invitationToken,
    });
    return "/app";
  }

  const accepted = await fetchAuthMutation(
    api.organizations.mutations.acceptPendingInvitationForCurrentUser,
    {},
  );
  if (accepted) {
    return "/app";
  }

  const hasOrganization = await fetchAuthQuery(
    api.organizations.queries.hasOrganization,
    {},
  );

  return hasOrganization ? "/app" : "/onboarding";
}
