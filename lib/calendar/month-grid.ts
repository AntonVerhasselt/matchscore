const BRUSSELS_TZ = "Europe/Brussels";

export type MonthGridCell = {
  date: Date;
  dayKey: string;
  inMonth: boolean;
};

function getBrusselsDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

function brusselsMidnightUtc(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRUSSELS_TZ,
    hour: "numeric",
    hour12: false,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(guess);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;
  const offsetHours = offsetPart
    ? Number.parseInt(offsetPart.replace("GMT", "").replace("+", ""), 10) || 0
    : 0;
  return new Date(Date.UTC(year, month - 1, day, -offsetHours, 0, 0));
}

export function formatMonthLabel(year: number, month: number, locale: string) {
  const date = brusselsMidnightUtc(year, month, 1);
  return new Intl.DateTimeFormat(locale, {
    timeZone: BRUSSELS_TZ,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getWeekdayLabels(locale: string): string[] {
  const monday = brusselsMidnightUtc(2024, 1, 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getTime() + index * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(locale, {
      timeZone: BRUSSELS_TZ,
      weekday: "short",
    }).format(date);
  });
}

export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const firstOfMonth = brusselsMidnightUtc(year, month, 1);
  const firstParts = getBrusselsDateParts(firstOfMonth);
  const firstWeekday = new Date(
    brusselsMidnightUtc(firstParts.year, firstParts.month, 1),
  );
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRUSSELS_TZ,
    weekday: "short",
  });
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const weekdayToken = weekdayFormatter.format(firstWeekday);
  const startOffset = weekdayMap[weekdayToken] ?? 0;

  const utcNoon = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return Array.from({ length: 42 }, (_, index) => {
    const date = utcNoon(
      firstParts.year,
      firstParts.month,
      1 - startOffset + index,
    );
    const parts = getBrusselsDateParts(date);
    const dayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

    return {
      date,
      dayKey,
      inMonth: parts.month === month,
    };
  });
}

export function getTodayDayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getCurrentBrusselsMonth(): { year: number; month: number } {
  const parts = getBrusselsDateParts(new Date());
  return { year: parts.year, month: parts.month };
}

export function getBrusselsMonthFromTimestamp(timestampMs: number): {
  year: number;
  month: number;
} {
  const parts = getBrusselsDateParts(new Date(timestampMs));
  return { year: parts.year, month: parts.month };
}

export function formatDayNumber(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BRUSSELS_TZ,
    day: "numeric",
  }).format(date);
}
