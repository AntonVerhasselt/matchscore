"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";

export function CheckoutFeedback() {
  const t = useTranslations("app.checkout");
  const searchParams = useSearchParams();
  const router = useRouter();
  const completeBillingOnboarding = useMutation(
    api.billing.mutations.skipBillingOnboarding,
  );
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout || handledRef.current === checkout) {
      return;
    }

    handledRef.current = checkout;

    const finishCheckoutReturn = async () => {
      if (checkout === "success") {
        try {
          await completeBillingOnboarding({});
          showSuccessToast(t("success"));
        } catch {
          showErrorToast(t("completeFailed"));
          return;
        }
      }

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("checkout");
      nextParams.delete("session_id");
      const query = nextParams.toString();
      router.replace(query ? `/app?${query}` : "/app", { scroll: false });
    };

    void finishCheckoutReturn();
  }, [completeBillingOnboarding, router, searchParams, t]);

  return null;
}
