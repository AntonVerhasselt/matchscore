import { normalizeCompetitionPath } from "./allowlist";
import type {
  FootballTeamAddress,
  ParsedClubTeam,
  SportsClubJsonLd,
  StamnummerEntry,
} from "./types";

const CURRENT_SEASON_COMPETITION_PATH =
  /href="(\/competities\/\d{4}-\d{4}[^"#]+)"/;

type CompetitionPanel = {
  compDomId: string;
  tabLabel?: string;
};

function getCompetitionPanels(html: string): CompetitionPanel[] {
  const tabs = [...html.matchAll(/href="#comp-(\d+)"[^>]*>([^<]+)<\/a>/g)];
  if (tabs.length > 0) {
    return tabs.map((tab) => ({
      compDomId: tab[1],
      tabLabel: tab[2].trim(),
    }));
  }

  const panelIds = [
    ...new Set([...html.matchAll(/id="comp-(\d+)"/g)].map((match) => match[1])),
  ];

  return panelIds.map((compDomId) => ({ compDomId }));
}

function parseTeamNameFromClubCell(
  clubCellHtml: string,
  slug: string,
  fallbackName: string,
): string {
  if (!clubCellHtml.includes(slug)) {
    return fallbackName;
  }

  const anchorMatches = [...clubCellHtml.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
  return (
    anchorMatches.at(-1)?.[1]?.trim() ??
    clubCellHtml.match(/alt="Clublogo voetbalvereniging ([^"]+)"/)?.[1]?.trim() ??
    fallbackName
  );
}

function parseTeamFromCompetitionPanel(
  html: string,
  panel: CompetitionPanel,
  slug: string,
  fallbackName: string,
  stamnummer?: string,
): ParsedClubTeam {
  const start = html.indexOf(`id="comp-${panel.compDomId}"`);
  const nextIndices = [...html.matchAll(/id="comp-\d+"/g)]
    .map((match) => match.index ?? -1)
    .filter((index) => index > start + 5);
  const end =
    nextIndices.length > 0 ? Math.min(...nextIndices) : start + 25_000;
  const block = html.slice(start, end);
  const rawCompetitionPath = block.match(CURRENT_SEASON_COMPETITION_PATH)?.[1];
  const competitionPath = rawCompetitionPath
    ? normalizeCompetitionPath(rawCompetitionPath)
    : undefined;

  const rows = [...block.matchAll(/<td class="club">([\s\S]*?)<\/td>/g)];
  const ownRow = rows.find((row) => row[1].includes(slug));
  const teamName = ownRow
    ? parseTeamNameFromClubCell(ownRow[1], slug, fallbackName)
    : fallbackName;

  return {
    tabLabel: panel.tabLabel,
    sourceCompetitionId: Number(panel.compDomId),
    competitionPath,
    teamName,
    stamnummer,
  };
}

function parseJsonLdGraph(html: string): Array<Record<string, unknown>> | null {
  const scriptRegex =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonLd = JSON.parse(match[1]) as {
        "@graph"?: Array<Record<string, unknown>>;
      };
      if (jsonLd["@graph"]) {
        return jsonLd["@graph"];
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parsePostalAddress(
  address: Record<string, unknown> | undefined,
): FootballTeamAddress | undefined {
  if (!address) {
    return undefined;
  }

  return {
    street:
      typeof address.streetAddress === "string"
        ? address.streetAddress
        : undefined,
    postalCode:
      typeof address.postalCode === "string" ? address.postalCode : undefined,
    city:
      typeof address.addressLocality === "string"
        ? address.addressLocality
        : undefined,
    region:
      typeof address.addressRegion === "string"
        ? address.addressRegion
        : undefined,
    country:
      typeof address.addressCountry === "string"
        ? address.addressCountry
        : undefined,
  };
}

export function parseStamnummersHtml(html: string): StamnummerEntry[] {
  const entries: StamnummerEntry[] = [];
  const re =
    /<dt class="col-sm-4">Stamnummer (\d+)<\/dt>\s*<dd class="col-sm-8"><a href="(\/clubs\/[^"]+)">[\s\S]*?<\/a>&nbsp;<a href="\2">([^<]+)<\/a><\/dd>/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    entries.push({
      stamnummer: match[1],
      slugPath: match[2],
      displayName: match[3],
    });
  }

  return entries;
}

export function parseSportsClubJsonLd(html: string): SportsClubJsonLd | null {
  const graph = parseJsonLdGraph(html);
  if (!graph) {
    return null;
  }

  const sportsClub = graph.find((node) => node["@type"] === "SportsClub") as
    | Record<string, unknown>
    | undefined;

  if (!sportsClub || typeof sportsClub.name !== "string") {
    return null;
  }

  return {
    name: sportsClub.name,
    branchCode:
      typeof sportsClub.branchCode === "string"
        ? sportsClub.branchCode
        : undefined,
    url: typeof sportsClub.url === "string" ? sportsClub.url : undefined,
    telephone:
      typeof sportsClub.telephone === "string"
        ? sportsClub.telephone
        : undefined,
    logo: typeof sportsClub.logo === "string" ? sportsClub.logo : undefined,
    address: parsePostalAddress(
      sportsClub.address as Record<string, unknown> | undefined,
    ),
  };
}

export function parseProvinceFromHtml(html: string): string | undefined {
  const bodyClass = html.match(/<body class="([^"]+)"/)?.[1];
  if (!bodyClass) {
    return undefined;
  }

  const provinces = [
    "antwerpen",
    "limburg",
    "oost-vlaanderen",
    "west-vlaanderen",
    "vlaams-brabant",
    "waals-brabant",
    "henegouwen",
    "luik",
    "luxemburg",
    "namen",
    "nationaal",
  ];

  for (const province of provinces) {
    if (bodyClass.split(/\s+/).includes(province)) {
      return province;
    }
  }

  return undefined;
}

export function parseClubTeamsFromHtml(
  html: string,
  slug: string,
): ParsedClubTeam[] {
  const sportsClub = parseSportsClubJsonLd(html);
  if (!sportsClub) {
    return [];
  }

  const panels = getCompetitionPanels(html);
  if (panels.length === 0) {
    return [
      {
        teamName: sportsClub.name,
        stamnummer: sportsClub.branchCode,
      },
    ];
  }

  return panels.map((panel) =>
    parseTeamFromCompetitionPanel(
      html,
      panel,
      slug,
      sportsClub.name,
      sportsClub.branchCode,
    ),
  );
}
