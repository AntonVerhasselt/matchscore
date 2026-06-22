"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { showErrorToast } from "@/lib/user-feedback";

export function useBillingPortal() {
  const t = useTranslations("settings.billing");
  const router = useRouter();
  const billing = useQuery(api.billing.queries.getOrgBillingState);
  const createPortalSession = useAction(
    api.billing.actions.createCustomerPortalSession,
  );
  const [isOpening, setIsOpening] = useState(false);

  const openBillingPortal = async () => {
    if (billing === undefined) {
      return;
    }

    if (billing === null || billing.plan === "none") {
      router.push("/onboarding");
      return;
    }

    setIsOpening(true);

    try {
      const result = await createPortalSession({});
      if (!result.url) {
        showErrorToast(t("portalFailed"));
        return;
      }
      window.location.assign(result.url);
    } catch {
      showErrorToast(t("portalFailed"));
    } finally {
      setIsOpening(false);
    }
  };

  return {
    openBillingPortal,
    isOpeningPortal: isOpening,
    isBillingReady: billing !== undefined,
  };
}
