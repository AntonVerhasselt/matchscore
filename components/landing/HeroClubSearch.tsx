"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type HeroClubSearchProps = {
  variant?: "default" | "hero";
};

export function HeroClubSearch({ variant = "default" }: HeroClubSearchProps) {
  const t = useTranslations("landing.hero");
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push("/sign-in");
  };

  const isHero = variant === "hero";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-stretch",
        isHero ? "max-w-2xl gap-3 sm:gap-4" : "max-w-xl",
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2",
            isHero ? "text-muted-foreground" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <Input
          type="search"
          name="club"
          placeholder={t("searchPlaceholder")}
          className={cn(
            "w-full pl-11 text-base",
            isHero &&
              "h-12 border-primary-foreground/20 bg-background text-base font-bold shadow-lg sm:h-14",
          )}
          aria-label={t("searchPlaceholder")}
          autoComplete="off"
          enterKeyHint="go"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        variant={isHero ? "secondary" : "default"}
        className={cn(
          "w-full shrink-0 sm:w-auto",
          isHero &&
            "h-12 bg-sidebar-primary px-6 text-base text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-14 sm:px-8",
        )}
      >
        {t("cta")}
      </Button>
    </form>
  );
}
