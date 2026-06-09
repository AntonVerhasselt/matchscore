"use client";

import { ArrowRight, Megaphone, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SOCIAL_PLATFORM_FAVICONS } from "@/lib/automations/social-platforms";
import {
  automationTemplatesPath,
  toPostingChannel,
  toBackendAutomationType,
  type AutomationSummary,
  type AutomationTypeSlug,
  type PostingChannel,
  type SocialChannel,
  type SocialPlatform,
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

const CHANNELS: SocialChannel[] = ["posts", "story"];
const PLATFORMS: SocialPlatform[] = ["facebook", "instagram"];

function PlatformHeader({ platform }: { platform: SocialPlatform }) {
  const tSocial = useTranslations("app.automations.social");

  return (
    <div className="flex items-center gap-2">
      <Image
        src={SOCIAL_PLATFORM_FAVICONS[platform]}
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
        unoptimized
      />
      <p className="text-sm font-medium">{tSocial(platform)}</p>
    </div>
  );
}

type PlatformBlockProps = {
  platform: SocialPlatform;
  automationType: AutomationTypeSlug;
  automation?: AutomationSummary;
  isSavingGlobalStatus: boolean;
  savingPostingChannel: PostingChannel | null;
  onPostingChannelChange: (
    postingChannel: PostingChannel,
    isEnabled: boolean,
  ) => void;
};

function PlatformBlock({
  platform,
  automationType,
  automation,
  isSavingGlobalStatus,
  savingPostingChannel,
  onPostingChannelChange,
}: PlatformBlockProps) {
  const tSocial = useTranslations("app.automations.social");
  const isGloballyEnabled = automation?.isGloballyEnabled ?? true;
  const isAnyPostingChannelSaving = savingPostingChannel !== null;

  return (
    <div>
      <PlatformHeader platform={platform} />
      <div className="mt-2 space-y-1.5 pl-6">
        {CHANNELS.map((channel) => {
          const postingChannel = toPostingChannel(platform, channel);
          const channelSwitchId = `${automationType}-${postingChannel}`;
          const isPostingChannelEnabled =
            automation?.postingChannels?.[postingChannel] ?? true;

          return (
            <div
            key={channel}
              className="flex items-center justify-between gap-6"
            >
              <span
                className={
                  isGloballyEnabled
                    ? "text-xs text-muted-foreground"
                    : "text-xs text-muted-foreground/50"
                }
              >
                {tSocial(channel)}
              </span>
              <Label htmlFor={channelSwitchId} className="sr-only">
                {tSocial("toggleChannel", {
                  platform: tSocial(platform),
                  channel: tSocial(channel),
                })}
              </Label>
              <Switch
                id={channelSwitchId}
                size="sm"
                checked={isPostingChannelEnabled}
                disabled={
                  !automation ||
                  !isGloballyEnabled ||
                  isSavingGlobalStatus ||
                  isAnyPostingChannelSaving
                }
                onCheckedChange={(checked) =>
                  onPostingChannelChange(postingChannel, checked)
                }
                aria-label={tSocial("toggleChannel", {
                  platform: tSocial(platform),
                  channel: tSocial(channel),
                })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const templateCountLabel = automation?.templateCountIsCapped
    ? t("templates.cappedShortCount", { count: templateCount })
    : t("templates.shortCount", { count: templateCount });

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
            {PLATFORMS.map((platform) => (
              <PlatformBlock
                key={platform}
                platform={platform}
                automationType={automationType}
                automation={automation}
                isSavingGlobalStatus={isSavingGlobalStatus}
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
