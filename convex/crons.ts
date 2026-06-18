import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync linked football competitions",
  { minutes: 15 },
  internal.football.syncActions.syncLinkedCompetitions,
  {},
);

crons.daily(
  "expire goal highlight stored videos",
  { hourUTC: 3, minuteUTC: 0 },
  internal.veoPosts.internalMutations.expireStoredVideos,
  {},
);

export default crons;
