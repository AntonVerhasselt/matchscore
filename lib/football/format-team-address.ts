export type FootballTeamAddress = {
  street?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  country?: string;
};

/** Formats imported club address for template `matchAddress` (home venue). */
export function formatTeamAddress(
  address: FootballTeamAddress | undefined,
): string {
  if (!address) {
    return "";
  }

  const parts: string[] = [];
  if (address.street?.trim()) {
    parts.push(address.street.trim());
  }

  const locality = [address.postalCode?.trim(), address.city?.trim()]
    .filter(Boolean)
    .join(" ");
  if (locality) {
    parts.push(locality);
  }

  return parts.join(", ");
}
