"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

const API_BASE = "https://api.voetbalinbelgie.be";

const ENDPOINT_PATHS = [
  "/stamnummers/",
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/1/",
  "/clubs/a/aartselaar-ksv/",
  "/wedstrijd/724391/20-09-2025-brasschaat-kfc-aartselaar-ksv/",
] as const;

function isProbablyHtml(body: string): boolean {
  const trimmed = body.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

async function fetchJson(path: string, apiKey: string) {
  const primaryUrl = `${API_BASE}${path}`;
  const headers = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
  };

  let response = await fetch(primaryUrl, { headers, redirect: "follow" });
  let body = await response.text();
  let requestUrl = primaryUrl;

  if (isProbablyHtml(body)) {
    requestUrl = `https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=${encodeURIComponent(path.replace(/^\//, ""))}`;
    response = await fetch(requestUrl, { headers, redirect: "follow" });
    body = await response.text();
  }

  let json: unknown = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }

  return {
    requestUrl,
    status: response.status,
    contentType: response.headers.get("content-type"),
    json,
    rawBodyPreview: body.slice(0, 500),
  };
}

/** Run on a Convex deployment that has VOETBALINBELGIE_API_KEY set. */
export const probeAllEndpoints = internalAction({
  args: {},
  returns: v.array(
    v.object({
      path: v.string(),
      requestUrl: v.string(),
      status: v.number(),
      contentType: v.union(v.string(), v.null()),
      json: v.union(v.any(), v.null()),
      rawBodyPreview: v.string(),
    }),
  ),
  handler: async () => {
    const apiKey = process.env.VOETBALINBELGIE_API_KEY;
    if (!apiKey) {
      throw new Error("VOETBALINBELGIE_API_KEY is not configured on this deployment");
    }

    const results = [];
    for (const path of ENDPOINT_PATHS) {
      const result = await fetchJson(path, apiKey);
      results.push({
        path,
        ...result,
      });
    }
    return results;
  },
});
