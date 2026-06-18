"use client";

import { ArrowRight, Megaphone, Trophy } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import {
  POSTING_CHANNEL_PLATFORMS,
  PostingChannelBlock,
} from "@/components/automations/posting-channel-block";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  automationTemplatesPath,
  toBackendAutomationType,
  type AutomationSummary,
  type AutomationTypeSlug,
  type PostingChannel,
} from "@/lib/automations/types";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation } from "convex/react";

const TYPE_ICONS: Record<
  AutomationTypeSlug,
  React.ComponentType<{ className?: string }>
> = {
  result: Trophy,
  preview: Megaphone,
};

type AutomationTypeCardProps = {
  automationType: AutomationTypeSlug;
  automation?: AutomationSummary;
};

export function AutomationTypeCard({
  automationType,
  automation,
}: AutomationTypeCardProps) {
  const t = useTranslations("app.automations");
  const Icon = TYPE_ICONS[automationType];
  const setAutomationGlobalEnabled = useMutation(
    api.automations.mutations.setAutomationGlobalEnabled,
  );
  const setAutomationPostingChannelEnabled = useMutation(
    api.automations.mutations.setAutomationPostingChannelEnabled,
  );
  const [isSavingGlobalStatus, setIsSavingGlobalStatus] = useState(false);
  const [savingPostingChannel, setSavingPostingChannel] =
    useState<PostingChannel | null>(null);

  const isGloballyEnabled = automation?.isGloballyEnabled ?? true;
  const templateCount = automation?.templateCount ?? 0;
  const isAnyPostingChannelSaving = savingPostingChannel !== null;
  const templateCountLabel = t("templates.shortCount", { count: templateCount });
  const showNoTemplatesHint =
    isGloballyEnabled && templateCount === 0 && automation !== undefined;

  const handleGlobalStatusChange = async (checked: boolean) => {
    if (!automation || isSavingGlobalStatus || isAnyPostingChannelSaving) {
      return;
    }

    setIsSavingGlobalStatus(true);

    try {
      await setAutomationGlobalEnabled({
        automationType: toBackendAutomationType(automationType),
        isGloballyEnabled: checked,
      });
      showSuccessToast(t("toggleSuccess"));
    } catch {
      showErrorToast(t("toggleFailed"));
    } finally {
      setIsSavingGlobalStatus(false);
    }
  };

  const handlePostingChannelChange = async (
    postingChannel: PostingChannel,
    checked: boolean,
  ) => {
    if (
      !automation ||
      !isGloballyEnabled ||
      isSavingGlobalStatus ||
      isAnyPostingChannelSaving
    ) {
      return;
    }

    setSavingPostingChannel(postingChannel);

    try {
      await setAutomationPostingChannelEnabled({
        automationType: toBackendAutomationType(automationType),
        postingChannel,
        isEnabled: checked,
      });
      showSuccessToast(t("channelToggleSuccess"));
    } catch {
      showErrorToast(t("channelToggleFailed"));
    } finally {
      setSavingPostingChannel(null);
    }
  };

  return (
    <article>
      <Card size="sm" className="overflow-hidden py-0">
        <div className="flex flex-col md:flex-row">
          {/* Left: icon, title, description, manage templates */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:justify-between md:gap-6">
            <div className="flex gap-3 md:gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center bg-muted text-foreground md:size-12">
                <Icon className="size-5 md:size-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-base font-semibold uppercase leading-tight tracking-wide break-words md:text-lg">
                  {t(`types.${automationType}.title`)}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`types.${automationType}.description`)}
                </p>
                {showNoTemplatesHint ? (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                    {t("templates.activeNoTemplatesHint")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  id={`${automationType}-global-status`}
                  checked={isGloballyEnabled}
                  disabled={
                    !automation || isSavingGlobalStatus || isAnyPostingChannelSaving
                  }
                  onCheckedChange={(checked) =>
                    void handleGlobalStatusChange(checked)
                  }
                  aria-label={t("toggleAutomation", {
                    type: t(`types.${automationType}.title`),
                  })}
                />
                <Label
                  htmlFor={`${automationType}-global-status`}
                  className="flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium">
                    {isGloballyEnabled ? t("enabled") : t("disabled")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {templateCountLabel}
                  </span>
                </Label>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full md:w-fit"
                asChild
              >
                <Link href={automationTemplatesPath(automationType)}>
                  {t("manageTemplates")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: social platforms */}
          <div className="flex w-full shrink-0 flex-col gap-5 border-t border-border p-4 md:w-[31%] md:justify-center md:border-t-0 md:border-l md:p-3">
            {POSTING_CHANNEL_PLATFORMS.map((platform) => (
              <PostingChannelBlock
                key={platform}
                platform={platform}
                idPrefix={automationType}
                postingChannels={
                  automation?.postingChannels ?? {
                    facebookPagePost: true,
                    facebookPageStory: true,
                    instagramProfilePost: true,
                    instagramProfileStory: true,
                  }
                }
                disabled={
                  !automation ||
                  !isGloballyEnabled ||
                  isSavingGlobalStatus ||
                  isAnyPostingChannelSaving
                }
                muted={!isGloballyEnabled}
                savingPostingChannel={savingPostingChannel}
                onPostingChannelChange={(postingChannel, checked) =>
                  void handlePostingChannelChange(postingChannel, checked)
                }
              />
            ))}
          </div>
        </div>
      </Card>
    </article>
  );
}
