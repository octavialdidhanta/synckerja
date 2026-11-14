import { describe, expect, it } from "vitest";
import { bigThoughtFixMode, buildBigThoughtFixPrompt, lessonsOnGate } from "@/thinking-lab/big-thought/passChecks";
import { stuckBigThoughtFixes } from "@/thinking-lab/big-thought/audit";

const scope = { preserve: [], repair: [] } as never;

describe("Big Thought fix mode", () => {
  it("patches first, then writes a new reason after the same kind check failed twice", () => {
    const one = [{ reason: "relation: reads as a method" }];
    const two = [...one, { reason: "relation: still a method" }];
    expect(lessonsOnGate(two, "relation")).toBe(2);
    expect(bigThoughtFixMode({ gate: "relation", lessons: one, replaceAfter: 2 })).toBe("repair");
    expect(bigThoughtFixMode({ gate: "relation", lessons: two, replaceAfter: 2 })).toBe("replace");
  });

  it("keeps patching checks that are not about the kind of statement", () => {
    const lessons = [{ reason: "premise: unsupported" }, { reason: "premise: unsupported" }];
    expect(bigThoughtFixMode({ gate: "premise", lessons, replaceAfter: 2 })).toBe("repair");
    expect(bigThoughtFixMode({ gate: "premise", lessons, replaceAfter: 2, force: "replace" })).toBe("replace");
  });

  it("the replace prompt drops the failed idea instead of keeping it", () => {
    const prompt = buildBigThoughtFixPrompt({
      parentStatement: "Sate kambing muda berani diadu juicy-nya sama wagyu.",
      failed: { code: "BT03", statement: "bumbu marinasi diracik khusus" },
      keepers: [{ code: "BT01", statement: "daging pilihan" }],
      scope,
      lessons: [{ statement: "bumbu marinasi diracik khusus", reason: "relation: method" }],
      mode: "replace",
    });
    expect(prompt).toContain("Do not keep the failed sentence's idea");
    expect(prompt).toContain("It is not a method");
    expect(prompt).toContain("BT01: daging pilihan");
    expect(prompt).not.toContain("Rewrite only the failed part");
  });
});

describe("stuck Big Thought fixes", () => {
  it("closes Fix once a code reaches the limit and shows the last check reason", () => {
    const lessons = Array.from({ length: 6 }, (_, index) => ({
      code: "BT03",
      statement: `try ${index}`,
      reason: index === 5 ? "No replacement came back." : `relation: method ${index}`,
    }));
    const stuck = stuckBigThoughtFixes([...lessons, { code: "BT01", statement: "x", reason: "premise: y" }], 6);
    expect(Object.keys(stuck)).toEqual(["BT03"]);
    expect(stuck.BT03).toEqual({ count: 6, reason: "relation: method 4" });
  });
});
