import { listEmailTemplates } from "@/emails/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DevEmailsIndexPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const templates = listEmailTemplates();

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Email templates</CardTitle>
              <Badge variant="secondary">Dev only</Badge>
            </div>
            <CardDescription>
              Development-only previews for transactional emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => (
              <Button
                key={template.slug}
                variant="outline"
                className="h-auto w-full justify-start px-4 py-3"
                asChild
              >
                <Link href={`/dev/emails/${template.slug}`}>
                  {template.name}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
