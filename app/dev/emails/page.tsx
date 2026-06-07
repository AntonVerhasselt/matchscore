import { listEmailTemplates } from "@/emails/registry";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DevEmailsIndexPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const templates = listEmailTemplates();

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-slate-800">Email templates</h1>
        <p className="mt-2 text-sm text-slate-600">
          Development-only previews for transactional emails.
        </p>
        <ul className="mt-8 flex flex-col gap-3">
          {templates.map((template) => (
            <li key={template.slug}>
              <Link
                href={`/dev/emails/${template.slug}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50"
              >
                {template.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
