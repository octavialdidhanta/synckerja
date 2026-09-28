import { describe, expect, it } from "vitest";
import { parseSiblingSet } from "@/thinking-lab/big-thought/semantic";
import { parseModelJson } from "@/thinking-lab/shared/ai";

describe("parseModelJson", () => {
  it("reads a sibling object that ends with a dangling empty string", () => {
    const script = `{
      "distinct": true,
      "duplicatePairs": [],
      "reasonContributions": [
        { "code": "BT03", "reasonContribution": "Kepercayaan organisasi" },
        { "code": "BT05", "reasonContribution": "Otonomi pemberi" }
      ],
      "resolution": "RESOLVED",
      "unresolvedReasons": [],
      ""
    }`;
    const parsed = parseModelJson(script) as { distinct: boolean };
    expect(parsed.distinct).toBe(true);
    const facts = parseSiblingSet(script, "fp", ["BT03", "BT05"]);
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).not.toContain("JUDGE_UNPARSEABLE");
    expect(facts.reasonContributions.map((row) => row.code)).toEqual(["BT03", "BT05"]);
  });
});
