import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync linked football competitions",
  { minutes: 15 },
  internal.football.syncActions.syncLinkedCompetitions,
  {},
);

export default crons;
