import type { AutomationType, TextBindingKey } from "./index";
import type { TemplateMatchDto } from "./template-match";

const TEXT_BINDING_KEYS_BY_AUTOMATION_TYPE: Record<
  AutomationType,
  readonly TextBindingKey[]
> = {
  match_announcement: [
    "homeClubName",
    "awayClubName",
    "homeAwayClubNames",
    "matchAddress",
    "matchDateTime",
  ],
  match_result: [
    "homeClubName",
    "awayClubName",
    "homeAwayClubNames",
    "matchAddress",
    "matchDateTime",
    "score",
  ],
};

export function formatMatchDateTime(
  kickoffAt: number,
  locale: "nl-BE",
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  }).format(new Date(kickoffAt));
}

const STANDARD_PLAYED_STATUS = "Gespeeld";

export function formatScore(match: TemplateMatchDto): string {
  if (
    match.status &&
    match.status !== STANDARD_PLAYED_STATUS &&
    match.resultText?.trim()
  ) {
    return match.resultText.trim();
  }

  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  return `${home} - ${away}`;
}

export function formatBinding(
  key: TextBindingKey,
  match: TemplateMatchDto,
  locale: "nl-BE",
): string {
  switch (key) {
    case "homeClubName":
      return match.homeClub.name;
    case "awayClubName":
      return match.awayClub.name;
    case "homeAwayClubNames":
      return `${match.homeClub.name} - ${match.awayClub.name}`;
    case "matchAddress":
      return match.address;
    case "matchDateTime":
      return formatMatchDateTime(match.kickoffAt, locale);
    case "score":
      return formatScore(match);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function isTextBindingAllowedForAutomationType(
  key: TextBindingKey,
  automationType: AutomationType,
): boolean {
  return TEXT_BINDING_KEYS_BY_AUTOMATION_TYPE[automationType].includes(key);
}
