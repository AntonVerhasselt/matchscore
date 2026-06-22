"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export function useOrgFeatures() {
  const context = useQuery(api.billing.queries.getOrgBillingContext);

  return {
    context,
    isLoading: context === undefined,
    hasGoalHighlights: context?.features.goalHighlightsGenerate ?? false,
    goalHighlightsBlockReason: context?.goalHighlightsBlockReason ?? null,
  };
}
