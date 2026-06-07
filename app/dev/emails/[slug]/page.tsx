import {
  getEmailTemplate,
  renderEmailPreview,
  type EmailTemplateSlug,
} from "@/emails/registry";
import {
  defaultLocale,
  isValidLocale,
  LOCALE_COOKIE_NAME,
  localeLabels,
} from "@/i18n/config";
import { loadEmailMessages } from "@/lib/i18n/load-email-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EmailPreviewPage({ params }: PageProps) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { slug } = await params;
  const template = getEmailTemplate(slug);

  if (!template) {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const messages = loadEmailMessages(locale);

  const { html, subject } = await renderEmailPreview(
    slug as EmailTemplateSlug,
    locale,
  );

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                {template.name}
              </h1>
              <Badge variant="secondary">Dev only</Badge>
              <Badge variant="outline">{localeLabels[locale]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Uses the same message loader as production.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dev/emails">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-foreground">{subject}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <CardDescription>Locale: {locale}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(messages).map(([key, value]) => (
                <div key={key} className="flex gap-2 font-mono text-sm">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="text-foreground">
                    {typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Separator />

        <Card className="overflow-hidden p-0">
          <iframe
            title={`${template.name} email preview`}
            srcDoc={html}
            sandbox="allow-same-origin"
            className="h-[640px] w-full border-0"
          />
        </Card>
      </div>
    </main>
  );
}
