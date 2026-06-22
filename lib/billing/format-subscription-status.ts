import type { SubscriptionStatus } from "@/convex/billing/types";

type SubscriptionStatusLabels = {
  active: string;
  pastDue: string;
  canceled: string;
  none: string;
  canceling: string;
};

export function formatSubscriptionStatusLabel(
  subscriptionStatus: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
  labels: SubscriptionStatusLabels,
): string {
  if (subscriptionStatus === "active" && cancelAtPeriodEnd) {
    return labels.canceling;
  }

  switch (subscriptionStatus) {
    case "active":
      return labels.active;
    case "past_due":
      return labels.pastDue;
    case "canceled":
      return labels.canceled;
    case "none":
      return labels.none;
    default: {
      const _exhaustive: never = subscriptionStatus;
      return _exhaustive;
    }
  }
}
