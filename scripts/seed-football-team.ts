/**
 * Seeds KSV Aartselaar on the dev Convex deployment for onboarding tests.
 *
 * Usage: pnpm seed:football-team
 */
import { execSync } from "node:child_process";

const result = execSync(
  "npx convex run dev/seedFootballTeam:seed '{}'",
  { encoding: "utf8", cwd: process.cwd() },
);

console.log(result.trim());
