import {
  getEmailTemplate,
  renderEmailPreview,
  type EmailTemplateSlug,
} from "@/emails/registry";
import { notFound } from "next/navigation";

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

  const { html, subject } = await renderEmailPreview(slug as EmailTemplateSlug);
  const variables = Object.entries(template.previewProps);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-lg font-semibold text-slate-800">
          Email preview: {template.name}
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          Preview uses placeholder values. Production sends real data via the
          same template.
        </p>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Subject
          </p>
          <p className="mt-1 font-mono text-sm text-slate-800">{subject}</p>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Variables
          </p>
          <dl className="mt-2 space-y-1">
            {variables.map(([name, value]) => (
              <div key={name} className="flex gap-2 font-mono text-sm">
                <dt className="text-slate-500">{name}</dt>
                <dd className="text-slate-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <iframe
            title={`${template.name} email preview`}
            srcDoc={html}
            className="h-[640px] w-full border-0"
          />
        </div>
      </div>
    </main>
  );
}
