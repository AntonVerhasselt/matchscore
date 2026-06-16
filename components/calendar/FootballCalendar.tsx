"use client";

import { CalendarEventBar } from "@/components/calendar/CalendarEventBar";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/lib/calendar/calendar-events";
import {
  buildMonthGrid,
  formatDayNumber,
  formatMonthLabel,
  getBrusselsMonthFromTimestamp,
  getCurrentBrusselsMonth,
  getTodayDayKey,
  getWeekdayLabels,
} from "@/lib/calendar/month-grid";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

type FootballCalendarProps = {
  year: number;
  month: number;
  eventsByDay: Map<string, CalendarEvent[]>;
  nextGameKickoffAt: number | null;
  onMonthChange: (year: number, month: number) => void;
};

export function FootballCalendar({
  year,
  month,
  eventsByDay,
  nextGameKickoffAt,
  onMonthChange,
}: FootballCalendarProps) {
  const locale = useLocale();
  const t = useTranslations("app.calendar");
  const todayKey = getTodayDayKey();
  const weekdayLabels = getWeekdayLabels(locale);
  const monthLabel = formatMonthLabel(year, month, locale);

  const cells = useMemo(
    () => buildMonthGrid(year, month),
    [month, year],
  );

  const goToPreviousMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
      return;
    }
    onMonthChange(year, month - 1);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
      return;
    }
    onMonthChange(year, month + 1);
  };

  const goToToday = () => {
    const today = getCurrentBrusselsMonth();
    onMonthChange(today.year, today.month);
  };

  const goToNextGame = () => {
    if (nextGameKickoffAt === null) {
      return;
    }
    const nextGameMonth = getBrusselsMonthFromTimestamp(nextGameKickoffAt);
    onMonthChange(nextGameMonth.year, nextGameMonth.month);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-heading text-lg font-bold tracking-tight capitalize text-foreground">
          {monthLabel}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {nextGameKickoffAt !== null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToNextGame}
            >
              {t("nextGame")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToToday}
          >
            {t("today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={goToPreviousMonth}
            aria-label={t("previousMonth")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={goToNextMonth}
            aria-label={t("nextMonth")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground sm:text-sm"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayEvents = eventsByDay.get(cell.dayKey) ?? [];
            const isToday = cell.dayKey === todayKey;
            const dayNumber = formatDayNumber(cell.date, locale);

            return (
              <div
                key={cell.dayKey}
                className={cn(
                  "min-h-24 border-r border-b p-1.5 sm:min-h-28 sm:p-2",
                  !cell.inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center text-xs font-medium sm:text-sm",
                      isToday &&
                        "rounded-md bg-destructive text-destructive-foreground",
                    )}
                  >
                    {dayNumber}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <CalendarEventBar
                      key={event.id}
                      kind={event.kind}
                      label={event.label}
                      tooltip={event.tooltip}
                      opponentLogoUrl={event.opponentLogoUrl}
                      opponentName={event.opponentName}
                    />
                  ))}
                  {dayEvents.length > 3 ? (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      {t("moreEvents", { count: dayEvents.length - 3 })}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
