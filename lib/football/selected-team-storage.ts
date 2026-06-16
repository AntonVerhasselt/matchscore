import type { Id } from "@/convex/_generated/dataModel";

const STORAGE_KEY = "matchscore:selectedFootballTeamId";

export function storeSelectedFootballTeamId(
  footballTeamId: Id<"footballTeams">,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, footballTeamId);
}

export function readSelectedFootballTeamId(): Id<"footballTeams"> | null {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem(STORAGE_KEY) as Id<"footballTeams"> | null;
}

export function clearSelectedFootballTeamId(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(STORAGE_KEY);
}
