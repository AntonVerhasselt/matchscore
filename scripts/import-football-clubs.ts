/**
 * Starts the VoetbalInBelgië club import and polls until complete.
 *
 * Usage:
 *   pnpm import:football-clubs           # incremental (skip clubs that look complete)
 *   pnpm import:football-clubs:full      # season rollover — re-fetch every club
 *
 * See Documentation/football-season-import.md
 */
import { execSync } from "node:child_process";

const fullImport = process.argv.includes("--full");

function runConvex(functionPath: string, args: Record<string, unknown>): string {
  return execSync(`npx convex run ${functionPath} '${JSON.stringify(args)}'`, {
    encoding: "utf8",
    cwd: process.cwd(),
  }).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  console.log(
    fullImport
      ? "Starting full football club import (season rollover)…"
      : "Starting incremental football club import…",
  );
  const kickoff = runConvex("football/actions:importAllClubs", {
    skipCompleteClubs: !fullImport,
  });
  console.log(kickoff);

  let previousCount = -1;
  let stablePolls = 0;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(15_000);

    const countRaw = runConvex("football/internalQueries:countFootballTeams", {});
    const count = Number.parseInt(countRaw.replace(/\n/g, ""), 10);

    console.log(`Imported teams: ${count}`);

    if (count === previousCount) {
      stablePolls += 1;
    } else {
      stablePolls = 0;
      previousCount = count;
    }

    if (count >= 1600 && stablePolls >= 2) {
      console.log("Import batches appear complete. Running repair + validation…");
      break;
    }
  }

  try {
    execSync(
      "pnpm repair:football-team-names",
      { encoding: "utf8", cwd: process.cwd(), stdio: "inherit" },
    );
    execSync(
      "pnpm test:football-pre-sync",
      { encoding: "utf8", cwd: process.cwd(), stdio: "inherit" },
    );
    console.log("Import and pre-sync validation complete.");
  } catch {
    console.log("Pre-sync failed — running targeted repair…");
    execSync(
      "pnpm repair:football-teams",
      { encoding: "utf8", cwd: process.cwd(), stdio: "inherit" },
    );
    execSync(
      "pnpm test:football-pre-sync",
      { encoding: "utf8", cwd: process.cwd(), stdio: "inherit" },
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
