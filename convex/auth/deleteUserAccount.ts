import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const relatedModels = ["session", "account", "twoFactor"] as const;

const paginationOpts = {
  cursor: null,
  numItems: 100,
} as const;

export const deleteUserAccount = internalMutation({
  args: {
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const model of relatedModels) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model,
          where: [
            {
              field: "userId",
              operator: "eq",
              value: args.userId,
            },
          ],
        },
        paginationOpts,
      });
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: {
        model: "user",
        where: [
          {
            field: "_id",
            operator: "eq",
            value: args.userId,
          },
        ],
      },
    });

    return null;
  },
});
