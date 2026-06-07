import {
  OTP_EXPIRES_IN_MINUTES,
  renderOtpSignInEmail,
} from "@/lib/emails/render-otp-sign-in";
import { notFound } from "next/navigation";

const SAMPLE_OTP = "123456";

export default async function OtpSignInEmailPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { html, subject } = await renderOtpSignInEmail({
    otp: SAMPLE_OTP,
    expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
  });

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-lg font-semibold text-slate-800">
          Email preview: OTP sign-in
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          Rendered with the same HTML and subject sent via Resend.
        </p>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Subject
          </p>
          <p className="mt-1 font-mono text-sm text-slate-800">{subject}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <iframe
            title="OTP sign-in email preview"
            srcDoc={html}
            className="h-[640px] w-full border-0"
          />
        </div>
      </div>
    </main>
  );
}
