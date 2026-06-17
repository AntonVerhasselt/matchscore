"use client";

import type { CalendarEventKind } from "@/lib/calendar/calendar-events";
import { cn } from "@/lib/utils";

type CalendarEventBarProps = {
  kind: CalendarEventKind;
  label: string;
  tooltip: string;
  opponentLogoUrl: string | null;
  opponentName: string;
  className?: string;
};

function CalendarOpponentLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "h-[1em] w-auto max-w-[1.4em] shrink-0 object-contain",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 text-[0.75em] leading-none font-bold uppercase opacity-50",
        className,
      )}
      aria-hidden
    >
      {name.slice(0, 2)}
    </span>
  );
}

export function CalendarEventBar({
  kind,
  label,
  tooltip,
  opponentLogoUrl,
  opponentName,
  className,
}: CalendarEventBarProps) {
  const isMatch = kind === "match";

  return (
    <div
      className={cn(
        "flex min-h-6 items-center gap-1 overflow-hidden rounded-sm px-1.5 py-0.5 text-[11px] leading-tight",
        isMatch
          ? "bg-[oklch(0.94_0.04_150)] text-[oklch(0.145_0_0)] shadow-[inset_3px_0_0_oklch(0.35_0.08_155)]"
          : "bg-blue-100 text-[oklch(0.145_0_0)] shadow-[inset_3px_0_0_oklch(0.45_0.12_250)] dark:bg-blue-100 dark:text-[oklch(0.145_0_0)]",
        className,
      )}
      title={tooltip}
    >
      <CalendarOpponentLogo
        name={opponentName}
        logoUrl={opponentLogoUrl}
        className={isMatch ? undefined : "h-[0.9em] max-w-[1.1em]"}
      />
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}
