import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";
import Stripe from "stripe";
import { httpAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authComponent, createAuth } from "./auth/instance";
import {
  handleCheckoutSessionCompletedWebhook,
  handlePaymentIntentSucceededWebhook,
  handleSubscriptionDeletedWebhook,
  handleSubscriptionUpdatedWebhook,
} from "./billing/webhookHandlers";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

function createStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(apiKey);
}

registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    "checkout.session.completed": async (ctx, event) => {
      await handleCheckoutSessionCompletedWebhook(
        ctx,
        event,
        createStripeClient(),
      );
    },
    "customer.subscription.updated": async (ctx, event) => {
      await handleSubscriptionUpdatedWebhook(ctx, event);
    },
    "customer.subscription.deleted": async (ctx, event) => {
      await handleSubscriptionDeletedWebhook(ctx, event);
    },
    "payment_intent.succeeded": async (ctx, event) => {
      await handlePaymentIntentSucceededWebhook(ctx, event);
    },
  },
});

http.route({
  path: "/webhooks/vgffmpeg",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    await ctx.scheduler.runAfter(0, internal.veoPosts.internalActions.handleVgfWebhook, {
      jobId: jobId as Id<"veoPostJobs">,
      payload,
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
