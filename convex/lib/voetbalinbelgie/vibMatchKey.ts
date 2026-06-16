export function buildVibMatchKey(
  sourceCompetitionId: number,
  date: string,
  home: string,
  away: string,
): string {
  return `${sourceCompetitionId}:${date}:${home}:${away}`;
}
