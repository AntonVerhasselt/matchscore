const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const BRUSSELS_TZ = "Europe/Brussels";

const TTL_WEEKDAY_MS = 4 * MS_PER_HOUR;
const TTL_WEEKEND_MORNING_MS = 1 * MS_PER_HOUR;
const TTL_WEEKEND_AFTERNOON_MS = 15 * MS_PER_MINUTE;

type BrusselsParts = {
  weekday: number;
  hour: number;
};

function getBrusselsParts(atMs: number): BrusselsParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRUSSELS_TZ,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(atMs));
  const weekdayToken = parts.find((part) => part.type === "weekday")?.value;
  const hourToken = parts.find((part) => part.type === "hour")?.value;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekday = weekdayToken ? (weekdayMap[weekdayToken] ?? 1) : 1;
  const hour = hourToken ? Number.parseInt(hourToken, 10) : 0;

  return { weekday, hour };
}

/**
 * Returns the minimum interval between competition API calls per VIB API Handleiding §4.
 */
export function getCompetitionSyncTtlMs(atMs: number): number {
  const { weekday, hour } = getBrusselsParts(atMs);

  if (weekday === 0 || weekday === 6) {
    return hour < 15 ? TTL_WEEKEND_MORNING_MS : TTL_WEEKEND_AFTERNOON_MS;
  }

  return TTL_WEEKDAY_MS;
}

export function shouldFetchCompetition(
  lastSyncedAt: number | undefined,
  atMs: number,
  options: { force?: boolean } = {},
): boolean {
  if (options.force) {
    return true;
  }
  if (lastSyncedAt === undefined) {
    return true;
  }
  return atMs - lastSyncedAt >= getCompetitionSyncTtlMs(atMs);
}
