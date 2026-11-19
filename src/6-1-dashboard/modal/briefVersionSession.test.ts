import { describe, expect, it } from "vitest";
import { briefContentBundle, briefVersionConflictNumber, shouldRecordBriefVersion } from "./briefVersionSession";

describe("shouldRecordBriefVersion", () => {
  const baseline = briefContentBundle({
    brief: "story",
    concept: "concept",
    caption: "caption",
    link: "link",
  });

  it("skips until the loaded brief is known", () => {
    expect(shouldRecordBriefVersion({
      recordedThisSession: false,
      baseline: null,
      draft: baseline,
    })).toBe(false);
  });

  it("skips when the draft matches the loaded brief", () => {
    expect(shouldRecordBriefVersion({
      recordedThisSession: false,
      baseline,
      draft: baseline,
    })).toBe(false);
  });

  it("records the first real change in the session", () => {
    expect(shouldRecordBriefVersion({
      recordedThisSession: false,
      baseline,
      draft: briefContentBundle({
        brief: "story changed",
        concept: "concept",
        caption: "caption",
        link: "link",
      }),
    })).toBe(true);
  });

  it("records only once per open dialog", () => {
    expect(shouldRecordBriefVersion({
      recordedThisSession: true,
      baseline,
      draft: briefContentBundle({
        brief: "story changed again",
        concept: "concept",
        caption: "caption",
        link: "link",
      }),
    })).toBe(false);
  });
});

describe("briefVersionConflictNumber", () => {
  it("reads the latest version from a conflict", () => {
    expect(briefVersionConflictNumber({
      message: "brief_version_conflict",
      details: "3",
    })).toBe(3);
  });

  it("ignores other save errors", () => {
    expect(briefVersionConflictNumber({ message: "Not allowed", details: "1" })).toBeNull();
    expect(briefVersionConflictNumber({ message: "brief_version_conflict", details: "" })).toBeNull();
  });
});
