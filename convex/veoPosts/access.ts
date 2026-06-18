import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { requireCurrentMembership } from "../automations/helpers";

export async function requireVeoPostJobForOrganization(
  ctx: QueryCtx | MutationCtx,
  jobId: Id<"veoPostJobs">,
): Promise<{ membership: Awaited<ReturnType<typeof requireCurrentMembership>>["membership"]; job: Doc<"veoPostJobs"> }> {
  const { membership } = await requireCurrentMembership(ctx);
  const job = await ctx.db.get("veoPostJobs", jobId);

  if (!job || job.organizationId !== membership.organizationId) {
    throw new ConvexError("Goal highlight job not found");
  }

  return { membership, job };
}

export async function listVeoPostJobsForOrganization(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<Array<Doc<"veoPostJobs">>> {
  return await ctx.db
    .query("veoPostJobs")
    .withIndex("by_organizationId_and_createdAt", (q) =>
      q.eq("organizationId", organizationId),
    )
    .order("desc")
    .collect();
}

export async function listVeoPostJobsBySlug(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  veoMatchSlug: string,
): Promise<Array<Doc<"veoPostJobs">>> {
  return await ctx.db
    .query("veoPostJobs")
    .withIndex("by_organizationId_and_veoMatchSlug", (q) =>
      q.eq("organizationId", organizationId).eq("veoMatchSlug", veoMatchSlug),
    )
    .collect();
}
