export type MockMatchDto = {
  homeClub: { name: string };
  awayClub: { name: string };
  address: string;
  kickoffAt: number;
  homeScore?: number;
  awayScore?: number;
};

/** Fixed kickoff: Saturday 15 March 2025, 20:00 Brussels (for stable nl-BE tests). */
export const DEFAULT_MOCK_MATCH_KICKOFF_AT = Date.parse(
  "2025-03-15T20:00:00+01:00",
);

export const DEFAULT_MOCK_MATCH: MockMatchDto = {
  homeClub: { name: "KFC Eendracht" },
  awayClub: { name: "Sporting Zuid" },
  address: "Sportpark De Klavers, Veldstraat 12",
  kickoffAt: DEFAULT_MOCK_MATCH_KICKOFF_AT,
  homeScore: 2,
  awayScore: 1,
};
