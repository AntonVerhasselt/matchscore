export function formatStripeUnixTimestamp(
  unixSeconds: number | null | undefined,
  locale?: string,
): string {
  if (unixSeconds == null || unixSeconds <= 0) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(unixSeconds * 1000));
}

export function formatMillisTimestamp(
  timestampMs: number | null | undefined,
  locale?: string,
): string {
  if (timestampMs == null) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}
