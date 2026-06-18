import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authComponent, createAuth } from "./auth/instance";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

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
