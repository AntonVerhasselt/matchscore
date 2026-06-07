import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingSection } from "@/components/landing/pricing/PricingSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  Clock,
  ImageIcon,
  Megaphone,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

type FaqItem = {
  question: string;
  answer: string;
};

type FeatureItem = {
  title: string;
  description: string;
};

type StepItem = {
  title: string;
  description: string;
};

export default async function Home() {
  const t = await getTranslations("landing");

  const faqItems = t.raw("faq.items") as FaqItem[];
  const features = t.raw("features.items") as FeatureItem[];
  const steps = t.raw("howItWorks.steps") as StepItem[];

  const featureIcons = [Megaphone, Trophy, ImageIcon, Users, Share2, Zap];

  return (
    <main className="flex-1 overflow-x-hidden">
      <HeroSection />

      {/* Problem — peeks into hero via negative margin */}
      <section
        id="problem"
        className="relative -mt-14 scroll-mt-16 bg-background sm:-mt-24 sm:scroll-mt-20"
      >
        <div
          className="h-14 border-t-2 border-sidebar-primary/40 bg-background shadow-[0_-24px_60px_-28px_rgba(0,0,0,0.3)] sm:h-28 dark:shadow-[0_-24px_60px_-28px_rgba(0,0,0,0.65)]"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-8 sm:pb-20 lg:px-10 lg:pb-24">
          <div className="grid items-center gap-8 sm:gap-14 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <h2 className="text-2xl tracking-tight text-balance uppercase sm:text-4xl lg:text-5xl">
                {t("problem.title")}
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted-foreground sm:mt-6 sm:text-base lg:text-lg">
                {t("problem.p1")}
              </p>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground sm:mt-4 sm:text-base lg:text-lg">
                {t("problem.p2")}
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden shadow-xl ring-1 ring-border">
              <Image
                src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80"
                alt={t("problem.imageAlt")}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-t border-border bg-muted/40 px-4 py-12 dark:bg-card/30 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 aspect-[4/3] overflow-hidden shadow-xl ring-1 ring-border lg:order-1">
            <Image
              src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80"
              alt={t("solution.imageAlt")}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <h2 className="text-xl tracking-tight text-balance uppercase sm:text-3xl lg:text-4xl">
              {t("solution.title")}
            </h2>
            <p className="mt-4 text-[0.9375rem] text-muted-foreground leading-relaxed sm:text-base">
              {t("solution.p1")}
            </p>
            <p className="mt-3 text-[0.9375rem] text-muted-foreground leading-relaxed sm:mt-4 sm:text-base">
              {t("solution.p2")}
            </p>
            <Button className="mt-8 h-12 w-full sm:w-auto" asChild>
              <Link href="/sign-in">{t("solution.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-16 bg-background px-4 py-12 sm:scroll-mt-20 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl tracking-tight text-balance uppercase sm:text-3xl lg:text-4xl">
              {t("howItWorks.title")}
            </h2>
            <p className="mt-4 text-[0.9375rem] text-muted-foreground sm:text-base">
              {t("howItWorks.description")}
            </p>
          </div>
          <div className="mt-8 grid gap-0 sm:mt-14 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative flex gap-4 border-b border-border/60 py-6 text-left last:border-b-0 md:flex-col md:items-center md:border-b-0 md:py-0 md:text-center"
              >
                <div className="flex size-12 shrink-0 items-center justify-center bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground sm:size-12 sm:text-lg md:mx-auto">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold sm:text-lg">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features / USPs */}
      <section
        id="features"
        className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-12 dark:bg-card/30 sm:scroll-mt-20 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl tracking-tight text-balance uppercase sm:text-3xl lg:text-4xl">
              {t("features.title")}
            </h2>
            <p className="mt-4 text-[0.9375rem] text-muted-foreground sm:text-base">
              {t("features.description")}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Sparkles;
              return (
                <Card
                  key={feature.title}
                  className="border-border/80 bg-card shadow-sm dark:border-border"
                >
                  <CardHeader className="gap-3 p-4 sm:p-6">
                    <div className="flex size-10 items-center justify-center bg-sidebar-primary/15 text-sidebar-primary">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-base sm:text-lg">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed sm:text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Showcase image */}
      <section className="bg-background px-4 py-12 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="relative aspect-[4/3] overflow-hidden shadow-xl ring-1 ring-border sm:aspect-[21/9]">
            <Image
              src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&q=80"
              alt={t("showcase.imageAlt")}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 sm:p-8 lg:p-12">
              <div className="max-w-xl text-white">
                <h3 className="text-lg text-balance uppercase sm:text-2xl lg:text-3xl">
                  {t("showcase.title")}
                </h3>
                <p className="mt-2 text-xs text-white/85 sm:text-base">
                  {t("showcase.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-16 bg-background px-4 py-12 sm:scroll-mt-20 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl tracking-tight text-balance uppercase sm:text-3xl lg:text-4xl">
              {t("faq.title")}
            </h2>
            <p className="mt-4 text-[0.9375rem] text-muted-foreground sm:text-base">
              {t("faq.description")}
            </p>
          </div>
          <div className="mx-auto mt-6 max-w-3xl border border-border bg-card px-2 shadow-sm sm:mt-12 sm:px-6">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-sidebar-border bg-sidebar px-4 py-12 text-sidebar-foreground sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-1 text-center sm:px-2">
          <Calendar className="size-8 opacity-80 sm:size-10" />
          <h2 className="mt-4 text-xl tracking-tight text-balance uppercase sm:mt-6 sm:text-3xl lg:text-4xl">
            {t("finalCta.title")}
          </h2>
          <p className="mt-4 max-w-xl text-[0.9375rem] text-sidebar-foreground/85 sm:text-base">
            {t("finalCta.description")}
          </p>
          <div className="mt-6 w-full max-w-sm sm:mt-8 sm:max-w-none">
            <Button
              size="lg"
              className="h-12 w-full bg-sidebar-foreground text-base text-sidebar hover:bg-sidebar-foreground/90 sm:w-auto"
              asChild
            >
              <Link href="/sign-in">{t("finalCta.cta")}</Link>
            </Button>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-sidebar-foreground/70">
            <Clock className="size-4 shrink-0" />
            <span>{t("finalCta.hint")}</span>
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
