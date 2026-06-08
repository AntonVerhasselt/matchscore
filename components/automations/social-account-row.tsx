"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SOCIAL_PLATFORM_FAVICONS } from "@/lib/automations/social-platforms";
import type {
  MockSocialAccount,
  SocialChannel,
  SocialPlatform,
} from "@/lib/automations/types";

const CHANNELS: SocialChannel[] = ["posts", "story"];

type SocialAccountRowProps = {
  account: MockSocialAccount;
  automationTypeSlug: string;
  onChannelChange: (
    platform: SocialPlatform,
    channel: SocialChannel,
    active: boolean,
  ) => void;
  onConnect: (platform: SocialPlatform) => void;
};

export function SocialAccountRow({
  account,
  automationTypeSlug,
  onChannelChange,
  onConnect,
}: SocialAccountRowProps) {
  const t = useTranslations("app.automations.social");

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Image
            src={SOCIAL_PLATFORM_FAVICONS[account.platform]}
            alt=""
            width={14}
            height={14}
            className="size-3.5 shrink-0"
            unoptimized
          />
          <p className="text-xs font-medium">{t(account.platform)}</p>
        </div>

        {account.connected ? (
          <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 pl-5">
            {CHANNELS.map((channel) => {
              const channelSwitchId = `${automationTypeSlug}-${account.platform}-${channel}`;

              return (
                <div key={channel} className="contents">
                  <span className="text-[11px] text-muted-foreground">
                    {t(channel)}
                  </span>
                  {/*
                   * Backend (future): per-channel toggle (feed post vs story).
                   * mutation setSocialChannelActive({ automationType, platform, channel, active })
                   */}
                  <>
                    <Label htmlFor={channelSwitchId} className="sr-only">
                      {t("toggleChannel", {
                        platform: t(account.platform),
                        channel: t(channel),
                      })}
                    </Label>
                    <Switch
                      id={channelSwitchId}
                      size="sm"
                      checked={account.channels[channel]}
                      onCheckedChange={(checked) =>
                        onChannelChange(account.platform, channel, checked)
                      }
                      aria-label={t("toggleChannel", {
                        platform: t(account.platform),
                        channel: t(channel),
                      })}
                    />
                  </>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-1 space-y-0.5 pl-5">
            {CHANNELS.map((channel) => (
              <p
                key={channel}
                className="text-[11px] text-muted-foreground/50"
              >
                {t(channel)}
              </p>
            ))}
          </div>
        )}
      </div>

      {!account.connected ? (
        /*
         * Backend (future): Meta OAuth — action initiateSocialConnect({ platform })
         * → redirect → callback persists socialConnections → refetch accounts.
         */
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="mt-0.5 h-7 shrink-0 px-2 text-[11px]"
          onClick={() => onConnect(account.platform)}
        >
          {t("connectAccount")}
        </Button>
      ) : null}
    </div>
  );
}
