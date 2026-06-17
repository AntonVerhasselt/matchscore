import { HeroClubSearch } from "@/components/landing/HeroClubSearch";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

export async function HeroSection() {
  const t = await getTranslations("landing");

  return (
    <section
      id="hero"
      className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden sm:min-h-[calc(100svh-4.5rem)] max-sm:min-h-[calc(100dvh-4rem)]"
    >
      <Image
        src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=80"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
        aria-hidden
      />

      <div className="absolute inset-0 bg-sidebar/90" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-b from-sidebar/50 via-transparent to-sidebar/95"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_var(--sidebar)_100%)] opacity-35"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-12 pb-24 text-center sm:px-8 sm:py-20 sm:pb-32 lg:px-10">
        <Badge
          variant="brand"
          className="mb-5 h-auto w-auto max-w-[min(100%,19rem)] border-sidebar-foreground/25 bg-sidebar-foreground/10 px-3 py-2 text-center text-[0.6875rem] leading-snug text-sidebar-foreground whitespace-normal sm:mb-8 sm:max-w-md sm:px-4 sm:text-xs"
        >
          {t("hero.badge")}
        </Badge>

        <h1 className="font-heading w-full max-w-7xl text-[1.75rem] leading-[0.94] tracking-tighter text-pretty text-sidebar-foreground uppercase sm:text-[2.75rem] md:text-[3.25rem] lg:text-[3.75rem] xl:text-[4.25rem]">
          {t.rich("hero.title", {
            highlight: (chunks) => (
              <span className="text-sidebar-primary">{chunks}</span>
            ),
          })}
        </h1>

        <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed font-medium text-balance text-sidebar-foreground/85 sm:mt-10 sm:text-base md:text-lg lg:text-xl">
          {t("hero.subtitle")}
        </p>

        <div className="mt-8 w-full sm:mt-12">
          <HeroClubSearch />
        </div>

        <p className="mt-4 max-w-md px-1 text-xs font-medium text-sidebar-foreground/65 sm:mt-5 sm:max-w-lg sm:px-0 sm:text-sm">
          {t("hero.hint")}
        </p>
      </div>
    </section>
  );
}
