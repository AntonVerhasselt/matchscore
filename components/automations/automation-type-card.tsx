"use client";

import { ArrowRight, Megaphone, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MOCK_SOCIAL_ACCOUNTS } from "@/lib/automations/mock-data";
import { SOCIAL_PLATFORM_FAVICONS } from "@/lib/automations/social-platforms";
import {
  automationTemplatesPath,
  type AutomationTypeSlug,
  type MockSocialAccount,
  type SocialChannel,
  type SocialPlatform,
} from "@/lib/automations/types";

const TYPE_ICONS: Record<
  AutomationTypeSlug,
  React.ComponentType<{ className?: string }>
> = {
  result: Trophy,
  preview: Megaphone,
};

const CHANNELS: SocialChannel[] = ["posts", "story"];

function cloneMockAccounts(): MockSocialAccount[] {
  return MOCK_SOCIAL_ACCOUNTS.map((account) => ({
    ...account,
    channels: { ...account.channels },
  }));
}

function PlatformHeader({ account }: { account: MockSocialAccount }) {
  const tSocial = useTranslations("app.automations.social");

  return (
    <div className="flex items-center gap-2">
      <Image
        src={SOCIAL_PLATFORM_FAVICONS[account.platform]}
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
        unoptimized
      />
      <p className="text-sm font-medium">{tSocial(account.platform)}</p>
    </div>
  );
}

type PlatformBlockProps = {
  account: MockSocialAccount;
  automationType: AutomationTypeSlug;
  onChannelChange: (
    platform: SocialPlatform,
    channel: SocialChannel,
    active: boolean,
  ) => void;
  onConnect: (platform: SocialPlatform) => void;
};

function PlatformBlock({
  account,
  automationType,
  onChannelChange,
  onConnect,
}: PlatformBlockProps) {
  const tSocial = useTranslations("app.automations.social");

  if (account.connected) {
    return (
      <div>
        <PlatformHeader account={account} />
        <div className="mt-2 space-y-1.5 pl-6">
          {CHANNELS.map((channel) => {
            const channelSwitchId = `${automationType}-${account.platform}-${channel}`;

            return (
              <div
                key={channel}
                className="flex items-center justify-between gap-6"
              >
                <span className="text-xs text-muted-foreground">
                  {tSocial(channel)}
                </span>
                {/*
                 * Backend (future): per-channel toggle.
                 * mutation setSocialChannelActive({ automationType, platform, channel, active })
                 */}
                <Label htmlFor={channelSwitchId} className="sr-only">
                  {tSocial("toggleChannel", {
                    platform: tSocial(account.platform),
                    channel: tSocial(channel),
                  })}
                </Label>
                <Switch
                  id={channelSwitchId}
                  size="sm"
                  checked={account.channels[channel]}
                  onCheckedChange={(checked) =>
                    onChannelChange(account.platform, channel, checked)
                  }
                  aria-label={tSocial("toggleChannel", {
                    platform: tSocial(account.platform),
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

  return (
    <div>
      <PlatformHeader account={account} />
      <div className="mt-2 flex items-center gap-4 pl-6">
        <div className="min-w-0 flex-1 space-y-1">
          {CHANNELS.map((channel) => (
            <p key={channel} className="text-xs text-muted-foreground/50">
              {tSocial(channel)}
            </p>
          ))}
        </div>
        {/*
         * Backend (future): Meta OAuth — action initiateSocialConnect({ platform })
         */}
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-auto shrink-0 px-2 py-1 text-[11px] leading-tight whitespace-normal"
          onClick={() => onConnect(account.platform)}
        >
          {tSocial("connectAccount")}
        </Button>
      </div>
    </div>
  );
}

type AutomationTypeCardProps = {
  automationType: AutomationTypeSlug;
};

export function AutomationTypeCard({
  automationType,
}: AutomationTypeCardProps) {
  const t = useTranslations("app.automations");
  const Icon = TYPE_ICONS[automationType];
  const [accounts, setAccounts] = useState<MockSocialAccount[]>(cloneMockAccounts);

  const handleChannelChange = (
    platform: SocialPlatform,
    channel: SocialChannel,
    active: boolean,
  ) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.platform === platform
          ? { ...a, channels: { ...a.channels, [channel]: active } }
          : a,
      ),
    );
  };

  const handleConnect = (platform: SocialPlatform) => {
    /*
     * Mock only — replace with OAuth redirect when socialConnections ships.
     */
    setAccounts((prev) =>
      prev.map((a) =>
        a.platform === platform
          ? {
              ...a,
              connected: true,
              channels: { posts: true, story: false },
            }
          : a,
      ),
    );
  };

  return (
    <article>
      <Card size="sm" className="overflow-hidden py-0">
        <div className="flex flex-row">
          {/* Left: icon, title, description, manage templates */}
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-4">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center bg-muted text-foreground">
                <Icon className="size-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-semibold uppercase leading-tight tracking-wide">
                  {t(`types.${automationType}.title`)}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`types.${automationType}.description`)}
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href={automationTemplatesPath(automationType)}>
                {t("manageTemplates")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          {/* Right: social platforms */}
          <div className="flex w-[31%] shrink-0 flex-col justify-center gap-5 border-l border-border p-3">
            {accounts.map((account) => (
              <PlatformBlock
                key={account.platform}
                account={account}
                automationType={automationType}
                onChannelChange={handleChannelChange}
                onConnect={handleConnect}
              />
            ))}
          </div>
        </div>
      </Card>
    </article>
  );
}
