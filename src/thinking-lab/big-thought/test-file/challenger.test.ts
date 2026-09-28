import { describe, expect, it } from "vitest";
import { buildChallengerPrompt, currentMissingWhy, normalizeChallenger } from "@/thinking-lab/big-thought/challenger";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

describe("challenger parser", () => {
  it("keeps a missing WHY only when description and boundary are present", () => {
    const parsed = normalizeChallenger(
      {
        status: "MISSING_MATERIAL_SUPPORT",
        missingWhyDescription: "The cause that makes the belief defensible",
        missingWhyBoundary: "A foundational cause, not a method",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set-1",
    );
    expect(parsed.status).toBe("MISSING_MATERIAL_SUPPORT");
    expect(parsed.missingWhyDescription).toContain("defensible");
    expect(parsed.missingWhyBoundary).toContain("not a method");
    expect(parsed).not.toHaveProperty("rows");
  });

  it("turns a missing WHY without a boundary into UNRESOLVED", () => {
    const parsed = normalizeChallenger(
      {
        status: "MISSING_MATERIAL_SUPPORT",
        missingWhyDescription: "Something is missing",
        missingWhyBoundary: "",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set-1",
    );
    expect(parsed.status).toBe("UNRESOLVED");
    expect(parsed.missingWhyDescription).toBe("");
  });

  it("does not name a domain or brand in the prompt", () => {
    const prompt = buildChallengerPrompt({
      parentStatement: "A general belief",
      rows: [{ code: "BT01", statement: "A stored reason" }],
    }).toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
    expect(prompt).toContain("distinct material support");
    expect(prompt).toContain("do not reclassify them and do not mark any row pass or fail.");
    expect(prompt).toContain("it must not be a restatement, paraphrase, or unpacking of the master thought itself.");
    expect(prompt).toContain("it must not be a reasoning job already held by an audited big thought.");
    expect(prompt).toContain("return complete.");
    expect(prompt).toContain("missing_material_support");
    expect(prompt).not.toContain("missing_foundational_why");
    expect(prompt).not.toContain("foundational why");
    expect(prompt).not.toContain("reasoncontribution");
  });

  it("returns the stored missing support only for the current set", () => {
    const parsed = normalizeChallenger(
      {
        status: "MISSING_MATERIAL_SUPPORT",
        missingWhyDescription: "The absent material support",
        missingWhyBoundary: "Only that support, not a method",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set-1",
    );
    expect(currentMissingWhy(parsed, "set-1")).toEqual({
      description: "The absent material support",
      boundary: "Only that support, not a method",
    });
    expect(currentMissingWhy(parsed, "set-2")).toBeNull();
    const complete = normalizeChallenger(
      { status: "COMPLETE", resolution: "RESOLVED", unresolvedReasons: [] },
      "set-1",
    );
    expect(complete.status).toBe("COMPLETE");
    expect(currentMissingWhy(complete, "set-1")).toBeNull();
  });

  it("does not keep the legacy missing status as a canonical challenger status", () => {
    const parsed = normalizeChallenger(
      {
        status: "MISSING_FOUNDATIONAL_WHY",
        missingWhyDescription: "An old missing reason",
        missingWhyBoundary: "An old boundary",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set-1",
    );
    expect(parsed.status).toBe("UNRESOLVED");
    expect(currentMissingWhy(parsed, "set-1")).toBeNull();
  });
});
