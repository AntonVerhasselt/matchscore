import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Home() {
  const t = await getTranslations("landing");

  return (
    <main className="flex-1">
      <section
        id="hero"
        className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8"
      >
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-4xl">{t("title")}</CardTitle>
            <CardDescription className="text-base">
              {t("subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/sign-in">{t("cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section
        id="pricing"
        className="scroll-mt-20 border-t bg-muted/30 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              {t("pricing.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("pricing.description")}
            </p>
          </div>
          <Card className="mx-auto mt-10 max-w-md">
            <CardHeader>
              <CardTitle>{t("pricing.planTitle")}</CardTitle>
              <CardDescription>{t("pricing.planDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{t("pricing.price")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("pricing.placeholder")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-20 border-t px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              {t("faq.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("faq.description")}</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("faq.q1")}</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  {t("faq.a1")}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("faq.q2")}</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  {t("faq.a2")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
