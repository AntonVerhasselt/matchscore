/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts"),
  ),
);

describe("replaceTemplateThumbnail", () => {
  test("stores a new thumbnail and deletes the previous blob", async () => {
    const t = convexTest(schema, modules);

    const firstStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["first"], { type: "image/jpeg" })),
    );
    const secondStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["second"], { type: "image/jpeg" })),
    );

    const templateId = await t.run(async (ctx) => {
      const footballTeamId = await ctx.db.insert("footballTeams", {
        name: "Test Team",
        vibTeamName: "Test Team",
        stamnummer: "1234",
        sourceCompetitionId: 1,
        competitionPath: "/test/",
        importSource: "club_page",
        importedAt: Date.now(),
      });

      const organizationId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        footballTeamId,
        createdByUserId: "user-1",
        createdAt: Date.now(),
      });

      return ctx.db.insert("automationTemplates", {
        organizationId,
        automationType: "match_result",
        name: "Result template",
        sceneDocument: {},
        canvasPreset: "instagram_square",
        schemaVersion: 1,
        createdByUserId: "user-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailStorageId: firstStorageId,
      });
    });

    await t.mutation(
      internal.automations.internalMutations.replaceTemplateThumbnail,
      {
        templateId,
        newStorageId: secondStorageId,
        previousStorageId: firstStorageId,
      },
    );

    const template = await t.run(async (ctx) => ctx.db.get(templateId));
    expect(template?.thumbnailStorageId).toBe(secondStorageId);

    const firstBlobExists = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(firstStorageId);
      return blob !== null;
    });
    const secondBlobExists = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(secondStorageId);
      return blob !== null;
    });

    expect(firstBlobExists).toBe(false);
    expect(secondBlobExists).toBe(true);
  });

  test("does not delete unrelated storage when previousStorageId is wrong", async () => {
    const t = convexTest(schema, modules);

    const firstStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["first"], { type: "image/jpeg" })),
    );
    const secondStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["second"], { type: "image/jpeg" })),
    );
    const unrelatedStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["unrelated"], { type: "image/jpeg" })),
    );

    const templateId = await t.run(async (ctx) => {
      const footballTeamId = await ctx.db.insert("footballTeams", {
        name: "Test Team",
        vibTeamName: "Test Team",
        stamnummer: "1234",
        sourceCompetitionId: 1,
        competitionPath: "/test/",
        importSource: "club_page",
        importedAt: Date.now(),
      });

      const organizationId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        footballTeamId,
        createdByUserId: "user-1",
        createdAt: Date.now(),
      });

      return ctx.db.insert("automationTemplates", {
        organizationId,
        automationType: "match_result",
        name: "Result template",
        sceneDocument: {},
        canvasPreset: "instagram_square",
        schemaVersion: 1,
        createdByUserId: "user-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailStorageId: firstStorageId,
      });
    });

    await t.mutation(
      internal.automations.internalMutations.replaceTemplateThumbnail,
      {
        templateId,
        newStorageId: secondStorageId,
        previousStorageId: unrelatedStorageId,
      },
    );

    const template = await t.run(async (ctx) => ctx.db.get(templateId));
    expect(template?.thumbnailStorageId).toBe(secondStorageId);

    const unrelatedBlobExists = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(unrelatedStorageId);
      return blob !== null;
    });
    const firstBlobExists = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(firstStorageId);
      return blob !== null;
    });

    expect(unrelatedBlobExists).toBe(true);
    expect(firstBlobExists).toBe(false);
  });
});
