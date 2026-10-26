import { describe, expect, it } from "vitest";
import {
  fixMistakeLines,
  fixScopeFromChecks,
  fixScopeLines,
  nextFixScope,
  openMistakeLines,
  scopeFromHistory,
} from "@/thinking-lab/shared/fixScope";

describe("fix scope", () => {
  it("repairs only the failed check and keeps the ones that passed", () => {
    const scope = fixScopeFromChecks([
      { id: "partOfBigThought", state: "pass" },
      { id: "siblingsDistinct", state: "fail", reason: "TR01 · TR03: the same meal choice" },
    ]);
    const lines = fixScopeLines(scope).join("\n");
    expect(lines).toContain("Change only the checks listed under Checks to repair.");
    expect(lines).toContain("partOfBigThought");
    expect(lines).toContain("siblingsDistinct: TR01 · TR03: the same meal choice");
    expect(lines).toContain("Move only the boundary");
  });

  it("points the next round at the new failure and remembers the passed checks", () => {
    const next = nextFixScope(
      { preserve: ["partOfBigThought"], repair: [{ id: "siblingsDistinct", reason: "overlap" }] },
      [
        { id: "partOfBigThought", state: "pass" },
        { id: "audienceLanguage", state: "fail", reason: "internal term" },
      ],
    );
    expect(next.preserve).toEqual(["partOfBigThought"]);
    expect(next.repair).toEqual([{ id: "audienceLanguage", reason: "internal term" }]);
  });

  it("tells a name-only failure to rename the same area", () => {
    const lines = fixScopeLines({
      preserve: ["partOfBigThought"],
      repair: [{ id: "audienceLanguage", reason: "Efisiensi makan is internal jargon" }],
    }).join("\n");
    expect(lines).toContain("Change only the name into the words the audience would use for this same area.");
    expect(lines).toContain("audienceLanguage: Efisiensi makan is internal jargon");
  });

  it("tells each remaining territory failure which part to move", () => {
    expect(
      fixScopeLines({
        preserve: ["audienceLanguage"],
        repair: [{ id: "partOfBigThought", reason: "the name copies the Big Thought" }],
      }).join("\n"),
    ).toContain("Change only the part that copies a keyword from the Big Thought.");
    expect(
      fixScopeLines({
        preserve: ["partOfBigThought", "audienceLanguage"],
        repair: [{ id: "questionArises", reason: "a different question comes up" }],
      }).join("\n"),
    ).toContain("the question the Big Thought answers actually comes up there");
    expect(
      fixScopeLines({
        preserve: ["partOfBigThought", "audienceLanguage", "questionArises"],
        repair: [{ id: "wideEnough", reason: "only one observation fits" }],
      }).join("\n"),
    ).toContain("Widen only the boundary");
  });

  it("tells an example failure to keep the observation and write one situation", () => {
    const lines = fixScopeLines({
      preserve: ["stakeHolds", "observationShape", "severalIdeas", "clearBoundary", "observationJob", "ownSubject"],
      repair: [{ id: "livedExample", reason: "the sentence only explains the pattern" }],
    }).join("\n");
    expect(lines).toContain("Write only one concrete situation a person could point at.");
    expect(lines).toContain("livedExample: the sentence only explains the pattern");
  });

  it("tells an observation failure to keep the observation and drop the because-reason", () => {
    const lines = fixScopeLines({
      preserve: ["stakeHolds", "observationShape", "severalIdeas", "clearBoundary"],
      repair: [{ id: "observationJob", reason: "the sentence explains why eating out feels cheaper" }],
    }).join("\n");
    expect(lines).toContain("Remove only the because-reason or the restatement of the parent.");
    expect(lines).toContain("observationJob: the sentence explains why eating out feels cheaper");
  });

  it("tells a stake failure to replace the scene and depend on that stake", () => {
    const lines = fixScopeLines({
      preserve: ["sentenceForm"],
      repair: [{ id: "stakeHolds", reason: "the idea still stands without the Angle" }],
    }).join("\n");
    expect(lines).toContain("Replace the scene.");
    expect(lines).toContain("Naming that stake inside the sentence is not enough.");
    expect(lines).toContain("A different situation is allowed.");
    expect(lines).not.toContain("Keep the act that already passed.");
    expect(lines).not.toContain("Keep the meaning that made those passed checks true.");
    expect(lines).toContain("stakeHolds: the idea still stands without the Angle");
  });

  it("tells a situation failure to drop the verbal conclusion", () => {
    const lines = fixScopeLines({
      preserve: ["sentenceForm", "stakeHolds", "mechanismShape", "vehicle", "recognizable"],
      repair: [{ id: "situationFelt", reason: "the sentence says this shows a conclusion" }],
    }).join("\n");
    expect(lines).toContain("Remove only the verbal explanation.");
    expect(lines).toContain("keep what the mechanism makes true");
    expect(lines).toContain("situationFelt: the sentence says this shows a conclusion");
  });

  it("rebuilds the failed checks from every earlier attempt when the checklist is empty", () => {
    const scope = scopeFromHistory([{ id: "partOfBigThought", state: "pending" }], [
      { reason: "audienceLanguage: Efisiensi makan is internal jargon" },
      { reason: "audienceLanguage: Hemat strategis is still a strategy term" },
      { reason: "siblingsDistinct: TR01 · TR04 cover the same meal choice" },
    ]);
    expect(scope.repair.map((item) => item.id)).toEqual(["audienceLanguage", "siblingsDistinct"]);
    expect(scope.repair[0]?.reason).toBe("Hemat strategis is still a strategy term");
  });

  it("counts every earlier failure of the same check", () => {
    const lines = fixMistakeLines([
      { reason: "audienceLanguage: Efisiensi makan is internal jargon" },
      { reason: "audienceLanguage: Hemat strategis is still a strategy term" },
      { reason: "No replacement came back." },
    ]).join("\n");
    expect(lines).toContain("audienceLanguage failed 2 time(s).");
    expect(lines).toContain("Efisiensi makan is internal jargon");
    expect(lines).toContain("Hemat strategis is still a strategy term");
    expect(lines).toContain("Other mistakes failed 1 time(s).");
  });

  it("leaves a check out of the memory once that check has passed", () => {
    const lines = openMistakeLines(
      [
        { reason: "stakeHolds: the angle no longer depended on the Territory" },
        { reason: "observationJob: the angle explains why eating out feels cheaper" },
        { reason: "No replacement came back." },
      ],
      { preserve: ["stakeHolds"], repair: [{ id: "observationJob", reason: "because-reason" }] },
    ).join("\n");
    expect(lines).toContain("observationJob failed 1 time(s).");
    expect(lines).not.toContain("stakeHolds");
    expect(lines).not.toContain("No replacement came back.");
  });
});