import { v } from "convex/values";
import { query } from "../_generated/server";
import { getOrgFeatureAccess } from "../lib/features";
import {
  AUTOMATION_TYPES,
  getEffectivePostingChannelStatuses,
  normalizePostingChannelStatuses,
  type PostingChannelStatuses,
} from "./constants";
import {
  getPrimaryOrganizationAutomation,
  requireCurrentMembership,
} from "./helpers";
import {
  automationTemplateDetailValidator,
  automationTemplateSummaryValidator,
  automationTypeValidator,
  postingChannelStatusesValidator,
} from "./validators";

const automationSummaryValidator = v.object({
  _id: v.id("organizationAutomations"),
  automationType: automationTypeValidator,
  isGloballyEnabled: v.boolean(),
  effectiveIsGloballyEnabled: v.boolean(),
  postingChannels: postingChannelStatusesValidator,
  effectivePostingChannels: postingChannelStatusesValidator,
  updatedAt: v.number(),
  updatedByUserId: v.union(v.string(), v.null()),
  templateCount: v.number(),
});

type LegacyAutomationStatusFields = {
  isEnabled?: boolean;
  isGloballyEnabled?: boolean;
  postingChannels?: Partial<PostingChannelStatuses>;
};

export const listAutomations = query({
  args: {},
  returns: v.array(automationSummaryValidator),
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);

    const organization = await ctx.db.get(membership.organizationId);
    const { automationsPost } = getOrgFeatureAccess({
      plan: organization?.plan,
      subscriptionStatus: organization?.subscriptionStatus,
    });

    const results = [];
    for (const automationType of AUTOMATION_TYPES) {
      const automation = await getPrimaryOrganizationAutomation(
        ctx,
        membership.organizationId,
        automationType,
      );
      if (!automation) {
        continue;
      }
      const automationStatus = automation as typeof automation &
        LegacyAutomationStatusFields;
      const isGloballyEnabled =
        automationStatus.isGloballyEnabled ?? automationStatus.isEnabled ?? true;
      const postingChannels = normalizePostingChannelStatuses(
        automationStatus.postingChannels,
      );

      const templatesForCount = await ctx.db
        .query("automationTemplates")
        .withIndex("by_organizationId_and_automationType", (q) =>
          q
            .eq("organizationId", membership.organizationId)
            .eq("automationType", automationType),
        )
        .collect();

      const effectiveIsGloballyEnabled =
        isGloballyEnabled && automationsPost;

      results.push({
        _id: automation._id,
        automationType: automation.automationType,
        isGloballyEnabled,
        effectiveIsGloballyEnabled,
        postingChannels,
        effectivePostingChannels: getEffectivePostingChannelStatuses(
          effectiveIsGloballyEnabled,
          postingChannels,
        ),
        updatedAt: automation.updatedAt,
        updatedByUserId: automation.updatedByUserId ?? null,
        templateCount: templatesForCount.length,
      });
    }

    return results;
  },
});

export const listTemplates = query({
  args: {
    automationType: v.optional(automationTypeValidator),
  },
  returns: v.array(automationTemplateSummaryValidator),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const automationType = args.automationType;

    const templates = automationType
      ? await ctx.db
          .query("automationTemplates")
          .withIndex("by_organizationId_and_automationType", (q) =>
            q
              .eq("organizationId", membership.organizationId)
              .eq("automationType", automationType),
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("automationTemplates")
          .withIndex("by_organizationId", (q) =>
            q.eq("organizationId", membership.organizationId),
          )
          .order("desc")
          .collect();

    return Promise.all(
      templates.map(async (template) => ({
        _id: template._id,
        name: template.name,
        automationType: template.automationType,
        canvasPreset: template.canvasPreset,
        schemaVersion: template.schemaVersion,
        updatedAt: template.updatedAt,
        thumbnailUrl: template.thumbnailStorageId
          ? ((await ctx.storage.getUrl(template.thumbnailStorageId)) ?? null)
          : null,
      })),
    );
  },
});

export const getTemplate = query({
  args: {
    templateId: v.id("automationTemplates"),
  },
  returns: v.union(automationTemplateDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const template = await ctx.db.get(args.templateId);

    if (!template || template.organizationId !== membership.organizationId) {
      return null;
    }

    return {
      _id: template._id,
      organizationId: template.organizationId,
      name: template.name,
      automationType: template.automationType,
      canvasPreset: template.canvasPreset,
      schemaVersion: template.schemaVersion,
      sceneDocument: template.sceneDocument,
      lastRenderPreviewStorageId: template.lastRenderPreviewStorageId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  },
});
