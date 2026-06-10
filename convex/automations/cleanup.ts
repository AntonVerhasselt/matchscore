import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Deletes automation/template data for an organization.
 * Call from a future `deleteOrganization` internal mutation together with
 * organization members, invitations, and the organization row itself.
 */
export async function deleteOrganizationAutomationData(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const templates = await ctx.db
    .query("automationTemplates")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  for (const template of templates) {
    if (template.lastRenderPreviewStorageId) {
      await ctx.storage.delete(template.lastRenderPreviewStorageId);
    }
    if (template.thumbnailStorageId) {
      await ctx.storage.delete(template.thumbnailStorageId);
    }
    await ctx.db.delete(template._id);
  }

  const assets = await ctx.db
    .query("templateAssets")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  for (const asset of assets) {
    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete(asset._id);
  }

  const automations = await ctx.db
    .query("organizationAutomations")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  for (const automation of automations) {
    await ctx.db.delete(automation._id);
  }
}
