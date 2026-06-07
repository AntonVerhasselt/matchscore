import type { ReactElement } from "react";

export type EmailTemplateDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> = {
  slug: string;
  name: string;
  previewProps: TProps;
  subject: (props: TProps) => string;
  Component: (props: TProps) => ReactElement;
};

export function defineEmailTemplate<
  TProps extends Record<string, unknown>,
>(definition: EmailTemplateDefinition<TProps>) {
  return definition;
}

export type PropsOf<T extends EmailTemplateDefinition> =
  T extends EmailTemplateDefinition<infer TProps> ? TProps : never;
