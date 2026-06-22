import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireOrgFeature } from "../billing/access";
import { Feature } from "../lib/features";
import {
  ensureOrganizationAutomations,
  getPrimaryOrganizationAutomation,
  requireCurrentMembership,
} from "./helpers";
import { normalizePostingChannelStatuses } from "./constants";
import { normalizeSceneDocument } from "../../lib/template-scene";
import { createStarterSceneDocument } from "./scenes";
import { assertTemplateAssetReferencesBelongToOrganization } from "../templateAssets/helpers";
import {
  automationTypeValidator,
  canvasPresetValidator,
  postingChannelValidator,
} from "./validators";
import { TEMPLATE_THUMBNAIL_GENERATION_DELAY_MS } from "./thumbnailConstants";

async function scheduleTemplateThumbnailGeneration(
  ctx: MutationCtx,
  templateId: Id<"automationTemplates">,
  updatedAt: number,
  delayMs: number,
) {
  await ctx.scheduler.runAfter(
    delayMs,
    internal.automations.actions.generateTemplateThumbnail,
    {
      templateId,
      expectedUpdatedAt: updatedAt,
    },
  );
}

export const ensureCurrentOrganizationAutomations = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    await ensureOrganizationAutomations(ctx, membership.organizationId, user._id);
    return null;
  },
});

export const setAutomationGlobalEnabled = mutation({
  args: {
    automationType: automationTypeValidator,
    isGloballyEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    await ensureOrganizationAutomations(ctx, membership.organizationId, user._id);

    const automation = await getPrimaryOrganizationAutomation(
      ctx,
      membership.organizationId,
      args.automationType,
    );

    if (!automation) {
      throw new ConvexError("Automation not found");
    }

    if (args.isGloballyEnabled) {
      await requireOrgFeature(
        ctx,
        membership.organizationId,
        Feature.AutomationsPost,
      );
    }

    await ctx.db.patch(automation._id, {
      isGloballyEnabled: args.isGloballyEnabled,
      postingChannels: normalizePostingChannelStatuses(automation.postingChannels),
      updatedAt: Date.now(),
      updatedByUserId: user._id,
    });

    return null;
  },
});

export const setAutomationPostingChannelEnabled = mutation({
  args: {
    automationType: automationTypeValidator,
    postingChannel: postingChannelValidator,
    isEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    await ensureOrganizationAutomations(ctx, membership.organizationId, user._id);

    const automation = await getPrimaryOrganizationAutomation(
      ctx,
      membership.organizationId,
      args.automationType,
    );

    if (!automation) {
      throw new ConvexError("Automation not found");
    }

    if (args.isEnabled) {
      await requireOrgFeature(
        ctx,
        membership.organizationId,
        Feature.AutomationsPost,
      );
    }

    await ctx.db.patch(automation._id, {
      postingChannels: {
        ...normalizePostingChannelStatuses(automation.postingChannels),
        [args.postingChannel]: args.isEnabled,
      },
      isGloballyEnabled: automation.isGloballyEnabled,
      updatedAt: Date.now(),
      updatedByUserId: user._id,
    });

    return null;
  },
});

export const createTemplate = mutation({
  args: {
    automationType: automationTypeValidator,
    canvasPreset: canvasPresetValidator,
    name: v.string(),
  },
  returns: v.id("automationTemplates"),
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    await ensureOrganizationAutomations(ctx, membership.organizationId, user._id);

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Template name is required");
    }

    const now = Date.now();
    const templateId = await ctx.db.insert("automationTemplates", {
      organizationId: membership.organizationId,
      automationType: args.automationType,
      name,
      sceneDocument: createStarterSceneDocument(args.canvasPreset),
      canvasPreset: args.canvasPreset,
      schemaVersion: 1,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await scheduleTemplateThumbnailGeneration(ctx, templateId, now, 0);

    return templateId;
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("automationTemplates"),
    name: v.string(),
    sceneDocument: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const template = await ctx.db.get(args.templateId);

    if (!template || template.organizationId !== membership.organizationId) {
      throw new ConvexError("Template not found");
    }

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Template name is required");
    }

    let sceneDocument;
    try {
      sceneDocument = normalizeSceneDocument(
        args.sceneDocument,
        template.canvasPreset,
        template.automationType,
      );
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Invalid scene document",
      );
    }
    await assertTemplateAssetReferencesBelongToOrganization(
      ctx,
      sceneDocument,
      membership.organizationId,
    );

    const updatedAt = Date.now();
    await ctx.db.patch(template._id, {
      name,
      sceneDocument,
      schemaVersion: 1,
      updatedAt,
      updatedByUserId: membership.userId,
    });

    await scheduleTemplateThumbnailGeneration(
      ctx,
      template._id,
      updatedAt,
      TEMPLATE_THUMBNAIL_GENERATION_DELAY_MS,
    );

    return null;
  },
});

export const duplicateTemplate = mutation({
  args: {
    templateId: v.id("automationTemplates"),
  },
  returns: v.id("automationTemplates"),
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    await ensureOrganizationAutomations(ctx, membership.organizationId, user._id);

    const template = await ctx.db.get(args.templateId);

    if (!template || template.organizationId !== membership.organizationId) {
      throw new ConvexError("Template not found");
    }

    await assertTemplateAssetReferencesBelongToOrganization(
      ctx,
      template.sceneDocument,
      membership.organizationId,
    );

    const now = Date.now();
    const duplicateId = await ctx.db.insert("automationTemplates", {
      organizationId: membership.organizationId,
      automationType: template.automationType,
      name: `${template.name.trim()} copy`,
      sceneDocument: template.sceneDocument,
      canvasPreset: template.canvasPreset,
      schemaVersion: template.schemaVersion,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await scheduleTemplateThumbnailGeneration(ctx, duplicateId, now, 0);

    return duplicateId;
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("automationTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const template = await ctx.db.get(args.templateId);

    if (!template || template.organizationId !== membership.organizationId) {
      throw new ConvexError("Template not found");
    }

    if (template.lastRenderPreviewStorageId) {
      await ctx.storage.delete(template.lastRenderPreviewStorageId);
    }

    if (template.thumbnailStorageId) {
      await ctx.storage.delete(template.thumbnailStorageId);
    }

    await ctx.db.delete(template._id);
    return null;
  },
});
