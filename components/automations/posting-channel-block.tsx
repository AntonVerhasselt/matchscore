"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SOCIAL_PLATFORM_FAVICONS } from "@/lib/automations/social-platforms";
import {
  toPostingChannel,
  type PostingChannel,
  type PostingChannelStatuses,
  type SocialChannel,
  type SocialPlatform,
} from "@/lib/automations/types";

export const POSTING_CHANNEL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
];
export const POSTING_CHANNEL_TYPES: SocialChannel[] = ["posts", "story"];

export function PlatformHeader({ platform }: { platform: SocialPlatform }) {
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

type PostingChannelBlockProps = {
  platform: SocialPlatform;
  idPrefix: string;
  postingChannels: PostingChannelStatuses;
  disabled?: boolean;
  savingPostingChannel: PostingChannel | null;
  onPostingChannelChange: (
    postingChannel: PostingChannel,
    isEnabled: boolean,
  ) => void;
  muted?: boolean;
};

export function PostingChannelBlock({
  platform,
  idPrefix,
  postingChannels,
  disabled = false,
  savingPostingChannel,
  onPostingChannelChange,
  muted = false,
}: PostingChannelBlockProps) {
  const tSocial = useTranslations("app.automations.social");
  const isAnyPostingChannelSaving = savingPostingChannel !== null;

  return (
    <div>
      <PlatformHeader platform={platform} />
      <div className="mt-2 space-y-1.5 pl-6">
        {POSTING_CHANNEL_TYPES.map((channel) => {
          const postingChannel = toPostingChannel(platform, channel);
          const channelSwitchId = `${idPrefix}-${postingChannel}`;
          const isPostingChannelEnabled = postingChannels[postingChannel];

          return (
            <div
              key={channel}
              className="flex items-center justify-between gap-6"
            >
              <span
                className={
                  muted
                    ? "text-xs text-muted-foreground/50"
                    : "text-xs text-muted-foreground"
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
                disabled={disabled || isAnyPostingChannelSaving}
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
