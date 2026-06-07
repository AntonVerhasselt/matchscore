"use client";

import { localeLabels, locales, type Locale } from "@/i18n/config";
import { setLocale } from "@/lib/i18n/set-locale";
import StatusAlert from "@/components/StatusAlert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LanguageSwitcherProps = {
  variant: "compact" | "full";
  triggerAriaLabelledBy?: string;
  tone?: "default" | "inverse";
};

export default function LanguageSwitcher({
  variant,
  triggerAriaLabelledBy,
  tone = "default",
}: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");

  const handleChange = (locale: Locale) => {
    if (locale === currentLocale || isPending) {
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const result = await setLocale(locale);
          if (!result.ok) {
            setError(tSettings("localeChangeFailed"));
            return;
          }
          router.refresh();
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : tSettings("localeChangeFailed");
          setError(message);
        }
      })();
    });
  };

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-2">
        {error && (
          <div className="max-w-48 text-xs">
            <StatusAlert variant="error">{error}</StatusAlert>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              aria-label={tCommon("language")}
              className={cn(
                "gap-1 px-2 font-bold uppercase",
                tone === "inverse"
                  ? "text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  : "hover:bg-transparent",
              )}
            >
              {currentLocale}
              <ChevronDownIcon
                className={cn(
                  "size-3.5",
                  tone === "inverse"
                    ? "text-sidebar-foreground/70"
                    : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-16">
            <DropdownMenuRadioGroup
              value={currentLocale}
              onValueChange={(value) => handleChange(value as Locale)}
            >
              {locales.map((locale) => (
                <DropdownMenuRadioItem
                  key={locale}
                  value={locale}
                  className="uppercase"
                >
                  {locale}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      <Select
        value={currentLocale}
        onValueChange={(value) => handleChange(value as Locale)}
        disabled={isPending}
      >
        <SelectTrigger
          className="w-full"
          aria-labelledby={triggerAriaLabelledBy}
        >
          <SelectValue>{localeLabels[currentLocale]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {localeLabels[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
