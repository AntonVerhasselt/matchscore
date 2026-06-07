import { render } from "@react-email/render";
import type { ReactElement } from "react";

export async function renderEmailTemplate(
  element: ReactElement,
  subject: string,
): Promise<{ html: string; subject: string }> {
  const html = await render(element);
  return { html, subject };
}
