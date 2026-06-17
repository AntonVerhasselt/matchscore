import type { Id } from "@/convex/_generated/dataModel";

const STORAGE_KEY = "matchscore:selectedFootballTeamId";

export function storeSelectedFootballTeamId(
  footballTeamId: Id<"footballTeams">,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, footballTeamId);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function readSelectedFootballTeamId(): Id<"footballTeams"> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY) as Id<"footballTeams"> | null;
  } catch {
    return null;
  }
}

export function clearSelectedFootballTeamId(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}
