import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function PublicHeader() {
  const t = await getTranslations("common.nav");

  return (
    <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-8 py-6">
      <Button
        variant="ghost"
        className="px-0 text-lg font-semibold hover:bg-transparent"
        asChild
      >
        <Link href="/">Matchscore</Link>
      </Button>
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </nav>
        <Separator orientation="vertical" className="h-4" />
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
