import type {
  CompetitionMatchRow,
  CompetitionMeta,
  LeagueTableRow,
  ParsedCompetitionDto,
  RelatedTeam,
} from "./types";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid competition field: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid competition field: ${field}`);
  }
  return value;
}

function parseMeta(raw: unknown): CompetitionMeta {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid competition meta");
  }

  const meta = raw as Record<string, unknown>;
  return {
    id: requireNumber(meta.id, "meta.id"),
    title: requireString(meta.title, "meta.title"),
    district: requireString(meta.district, "meta.district"),
    season: requireString(meta.season, "meta.season"),
  };
}

function parseRelatedTeams(raw: unknown): RelatedTeam[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid related team row");
    }
    const row = entry as Record<string, unknown>;
    return {
      name: requireString(row.name, "related.name"),
      shirt: typeof row.shirt === "string" ? row.shirt : undefined,
      logo: typeof row.logo === "string" ? row.logo : undefined,
      href: typeof row.href === "string" ? row.href : undefined,
    };
  });
}

function parsePointsPunished(value: unknown): string {
  if (value === null || value === undefined) {
    return "0";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  throw new Error("Invalid competition field: leaguetable.pointsPunished");
}

function parseLeagueTable(raw: unknown): LeagueTableRow[] {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid leaguetable");
  }

  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid leaguetable row");
    }
    const row = entry as Record<string, unknown>;
    return {
      position: requireNumber(row.position, "leaguetable.position"),
      name: requireString(row.name, "leaguetable.name"),
      shirt: typeof row.shirt === "string" ? row.shirt : undefined,
      logo: typeof row.logo === "string" ? row.logo : undefined,
      matches: requireNumber(row.matches, "leaguetable.matches"),
      wins: requireNumber(row.wins, "leaguetable.wins"),
      ties: requireNumber(row.ties, "leaguetable.ties"),
      losses: requireNumber(row.losses, "leaguetable.losses"),
      points: requireNumber(row.points, "leaguetable.points"),
      goalsFor: requireNumber(row.goalsFor, "leaguetable.goalsFor"),
      goalsAgainst: requireNumber(row.goalsAgainst, "leaguetable.goalsAgainst"),
      pointsPunished: parsePointsPunished(row.pointsPunished),
    };
  });
}

function parseMatchRows(raw: unknown, label: string): CompetitionMatchRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid ${label} row at index ${index}`);
    }
    const row = entry as Record<string, unknown>;
    const match: CompetitionMatchRow = {
      status: requireString(row.status, `${label}.status`),
      date: requireString(row.date, `${label}.date`),
      home: requireString(row.home, `${label}.home`),
      away: requireString(row.away, `${label}.away`),
      result: typeof row.result === "string" ? row.result : undefined,
    };

    if (typeof row.homeGoals === "number") {
      match.homeGoals = row.homeGoals;
    }
    if (typeof row.awayGoals === "number") {
      match.awayGoals = row.awayGoals;
    }

    return match;
  });
}

export function parseCompetitionJson(raw: unknown): ParsedCompetitionDto {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid competition JSON");
  }

  const root = raw as Record<string, unknown>;
  const competition = root.competition;
  if (!competition || typeof competition !== "object") {
    throw new Error("Missing competition object");
  }

  const payload = competition as Record<string, unknown>;
  const links =
    payload.links && typeof payload.links === "object"
      ? (payload.links as Record<string, unknown>)
      : undefined;

  return {
    meta: parseMeta(payload.meta),
    relatedTeams: parseRelatedTeams(links?.related),
    leaguetable: parseLeagueTable(payload.leaguetable),
    results: parseMatchRows(payload.results, "results"),
    program: parseMatchRows(payload.program, "program"),
  };
}
