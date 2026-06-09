import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  AUTOMATION_TYPES,
  TEMPLATE_COUNT_CAP,
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
  postingChannels: postingChannelStatusesValidator,
  effectivePostingChannels: postingChannelStatusesValidator,
  updatedAt: v.number(),
  updatedByUserId: v.union(v.string(), v.null()),
  templateCount: v.number(),
  templateCountIsCapped: v.boolean(),
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
        .take(TEMPLATE_COUNT_CAP + 1);
      const templateCountIsCapped = templatesForCount.length > TEMPLATE_COUNT_CAP;

      results.push({
        _id: automation._id,
        automationType: automation.automationType,
        isGloballyEnabled,
        postingChannels,
        effectivePostingChannels: getEffectivePostingChannelStatuses(
          isGloballyEnabled,
          postingChannels,
        ),
        updatedAt: automation.updatedAt,
        updatedByUserId: automation.updatedByUserId ?? null,
        templateCount: Math.min(templatesForCount.length, TEMPLATE_COUNT_CAP),
        templateCountIsCapped,
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
          .take(100)
      : await ctx.db
          .query("automationTemplates")
          .withIndex("by_organizationId", (q) =>
            q.eq("organizationId", membership.organizationId),
          )
          .order("desc")
          .take(100);

    return templates.map((template) => ({
      _id: template._id,
      name: template.name,
      automationType: template.automationType,
      canvasPreset: template.canvasPreset,
      schemaVersion: template.schemaVersion,
      updatedAt: template.updatedAt,
    }));
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
      name: template.name,
      automationType: template.automationType,
      canvasPreset: template.canvasPreset,
      schemaVersion: template.schemaVersion,
      sceneDocument: template.sceneDocument,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  },
});
