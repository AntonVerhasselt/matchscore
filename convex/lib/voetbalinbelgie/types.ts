export type FootballTeamAddress = {
  street?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  country?: string;
};

export type StamnummerEntry = {
  stamnummer: string;
  slugPath: string;
  displayName: string;
};

export type SportsClubJsonLd = {
  name: string;
  branchCode?: string;
  url?: string;
  telephone?: string;
  logo?: string;
  address?: FootballTeamAddress;
};

export type ParsedClubTeam = {
  tabLabel?: string;
  sourceCompetitionId?: number;
  competitionPath?: string;
  teamName: string;
  stamnummer?: string;
};

export type CompetitionMeta = {
  id: number;
  title: string;
  district: string;
  season: string;
};

export type RelatedTeam = {
  name: string;
  shirt?: string;
  logo?: string;
  href?: string;
};

export type LeagueTableRow = {
  position: number;
  name: string;
  shirt?: string;
  logo?: string;
  matches: number;
  wins: number;
  ties: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsPunished: string;
};

export type CompetitionMatchRow = {
  status: string;
  date: string;
  home: string;
  away: string;
  homeGoals?: number;
  awayGoals?: number;
  result?: string;
};

export type ParsedCompetitionDto = {
  meta: CompetitionMeta;
  relatedTeams: RelatedTeam[];
  leaguetable: LeagueTableRow[];
  results: CompetitionMatchRow[];
  program: CompetitionMatchRow[];
};
