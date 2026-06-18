import { describe, expect, test } from "vitest";
import {
  buildScoreMismatchWarning,
  filterGoalHighlights,
  isGoalHighlightTag,
  parseVeoMatchSlug,
  resolveExistingJob,
  type VeoHighlight,
} from "./helpers";

describe("parseVeoMatchSlug", () => {
  test("extracts slug from standard match URLs", () => {
    expect(
      parseVeoMatchSlug(
        "https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/",
      ),
    ).toBe("20260321-match-ksva-seniors-a-vee5ec95");
    expect(
      parseVeoMatchSlug(
        "https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/highlights",
      ),
    ).toBe("20260321-match-ksva-seniors-a-vee5ec95");
  });

  test("rejects non-app URLs", () => {
    expect(parseVeoMatchSlug("https://veo.com/matches/foo")).toBeNull();
    expect(parseVeoMatchSlug("not-a-url")).toBeNull();
  });
});

describe("isGoalHighlightTag", () => {
  test("includes goal tags and excludes shot-on-goal", () => {
    expect(isGoalHighlightTag("goal")).toBe(true);
    expect(isGoalHighlightTag("penalty-goal")).toBe(true);
    expect(isGoalHighlightTag("own-goal")).toBe(true);
    expect(isGoalHighlightTag("shot-on-goal")).toBe(false);
    expect(isGoalHighlightTag("corner")).toBe(false);
  });
});

describe("filterGoalHighlights", () => {
  const baseHighlight = (
    overrides: Partial<VeoHighlight> & Pick<VeoHighlight, "id" | "start">,
  ): VeoHighlight => ({
    duration: 25,
    tags: [{ name: "Goal", slug: "goal", origin: "1", custom: false }],
    videos: [
      {
        url: "https://c.veocdn.com/video.mp4",
        width: 1920,
        height: 1080,
        mime_type: "video/mp4",
        bit_rate: null,
        created: "2026-03-22T01:54:47.865396+01:00",
      },
    ],
    comment: null,
    should_render: true,
    ...overrides,
  });

  test("filters, sorts, and excludes invalid clips", () => {
    const highlights = filterGoalHighlights([
      baseHighlight({ id: "b", start: 200 }),
      baseHighlight({
        id: "shot",
        start: 100,
        tags: [
          {
            name: "Shot on goal",
            slug: "shot-on-goal",
            origin: "1",
            custom: false,
          },
        ],
      }),
      baseHighlight({ id: "a", start: 100 }),
      baseHighlight({
        id: "pending",
        start: 300,
        should_render: false,
      }),
      baseHighlight({
        id: "missing-video",
        start: 400,
        videos: [],
      }),
    ]);

    expect(highlights.map((highlight) => highlight.id)).toEqual(["a", "b"]);
  });
});

describe("resolveExistingJob", () => {
  const now = 1_700_000_000_000;

  test("opens in-flight jobs silently", () => {
    const decision = resolveExistingJob(
      [
        {
          _id: "job_failed",
          status: "failed",
          createdAt: now - 1000,
        },
        {
          _id: "job_processing",
          status: "processing",
          createdAt: now - 500,
        },
      ],
      now,
    );

    expect(decision).toEqual({
      action: "open",
      jobId: "job_processing",
      reopenCached: false,
    });
  });

  test("opens valid ready jobs as cached reopen", () => {
    const decision = resolveExistingJob(
      [
        {
          _id: "job_ready",
          status: "ready",
          outputStorageId: "storage",
          expiresAt: now + 1000,
          createdAt: now - 500,
        },
      ],
      now,
    );

    expect(decision).toEqual({
      action: "open",
      jobId: "job_ready",
      reopenCached: true,
    });
  });

  test("creates a new job when no reusable rows exist", () => {
    expect(
      resolveExistingJob(
        [
          {
            _id: "job_expired",
            status: "ready",
            expiresAt: now - 1,
            createdAt: now - 2000,
          },
        ],
        now,
      ),
    ).toEqual({
      action: "open",
      jobId: "job_expired",
      reopenCached: false,
    });
  });

  test("opens failed jobs instead of creating duplicates", () => {
    expect(
      resolveExistingJob(
        [
          {
            _id: "job_failed",
            status: "failed",
            createdAt: now - 1000,
          },
        ],
        now,
      ),
    ).toEqual({
      action: "open",
      jobId: "job_failed",
      reopenCached: false,
    });
  });

  test("creates a new job when no rows exist", () => {
    expect(resolveExistingJob([], now)).toEqual({ action: "create" });
  });
});

describe("buildScoreMismatchWarning", () => {
  test("returns null when score matches goal count", () => {
    expect(
      buildScoreMismatchWarning(
        {
          slug: "x",
          title: "A - B",
          privacy: "public",
          isAccessible: true,
          clubName: "A",
          opponentName: "B",
          scoreOwn: 1,
          scoreOpponent: 2,
        },
        3,
      ),
    ).toBeNull();
  });

  test("returns a warning when counts differ", () => {
    expect(
      buildScoreMismatchWarning(
        {
          slug: "x",
          title: "A - B",
          privacy: "public",
          isAccessible: true,
          clubName: "A",
          opponentName: "B",
          scoreOwn: 1,
          scoreOpponent: 2,
        },
        2,
      ),
    ).toContain("3 goals");
  });
});
