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
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl">{t("title")}</CardTitle>
          <CardDescription className="text-base">{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" asChild>
            <Link href="/app">{t("cta")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
