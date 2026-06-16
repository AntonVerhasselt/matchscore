/**
 * Validates that all teams referenced in allowlisted competitions exist in Convex.
 *
 * Usage: pnpm test:football-pre-sync
 */
import { execSync } from "node:child_process";

const result = execSync(
  "npx convex run football/internalActions:validateAllowlistedCompetitionTeams '{}'",
  { encoding: "utf8", cwd: process.cwd() },
);

const parsed = JSON.parse(result.trim()) as {
  ok: boolean;
  results: Array<{
    path: string;
    competitionId: number;
    ok: boolean;
    missing: string[];
  }>;
};

console.log(JSON.stringify(parsed, null, 2));

if (!parsed.ok) {
  console.error("\nPre-sync validation failed.");
  for (const entry of parsed.results) {
    if (!entry.ok) {
      console.error(
        `- ${entry.path} (${entry.competitionId}): missing ${entry.missing.join(", ")}`,
      );
    }
  }
  process.exit(1);
}

console.log("\nPre-sync validation passed for all allowlisted competitions.");
