import { describe, expect, it, vi } from "vitest";
import { normalizeExecutionFacts } from "@/thinking-lab/execution/semantic";
import { pillarNeedsRecommendation } from "@/thinking-lab/execution/recommend";
import {
  buildExecutionMeaningRepairPrompt,
  buildExecutionPassPrompt,
  executionChecklistPassed,
  executionChecksFromAudit,
  executionFailureMoved,
  mergeExecutionAuditLessons,
  runExecutionMeaningChecks,
  runExecutionOpenChecks,
} from "@/thinking-lab/execution/passChecklist";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";

const script: VoiceOverScript = {
  title: "Judul",
  caption: "",
  assets: { locations: [], characters: [], properties: [] },
  scenes: [
    { id: "s1", title: "Mekanisme", lines: [{ id: "s1-l1", narration: "Mekanismenya kelihatan.", shots: [] }] },
    { id: "s2", title: "Penutup", lines: [{ id: "s2-l1", narration: "Hematnya jadi kelihatan.", shots: [] }] },
  ],
  lineIssues: [],
  audio: { sound: false, music: false },
};

const base = {
  pillar: "Behind The Scene",
  masterStatement: "Makan di luar hemat dan lauknya lebih variatif.",
  masterSubject: "Skala bahan",
  ideaStatement: "Kita bandingkan harga per ons sehingga hematnya terlihat.",
  script,
  onStep: () => undefined,
};

describe("execution pass checklist", () => {
  it("stops at the first failed check and does not ask for another pillar after a new claim", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("adds no claim")) return '{"pass":false,"reason":"Ada klaim baru.","lineIds":["s1-l1"]}';
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({ ...base, masterSells: "unknown", ask });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(result.facts.relationToParent).toBe("MESSAGE_ADDED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "messageStays")?.state).toBe("fail");
    expect(result.checks.find((check) => check.id === "causeChain")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "conclusionLands")?.state).toBe("pending");
  });

  it("fails Flash Sale locally when the Master Thought is not selling and asks for another pillar", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runExecutionMeaningChecks({
      ...base,
      pillar: "Flash Sale Hook",
      masterSells: false,
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.checks.find((check) => check.id === "sellingFits")).toMatchObject({
      state: "fail",
      reason: "Flash Sale Hook needs a Master Thought that is actually selling.",
    });
    expect(result.facts.relationToParent).toBe("PILLAR_NOT_SELLING");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(true);
    expect(result.checks.find((check) => check.id === "mechanismVisible")?.state).toBe("pending");
  });

  it("stops an unresolved Flash Sale without a pillar recommendation", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runExecutionMeaningChecks({
      ...base,
      pillar: "Flash Sale Hook",
      masterSells: "unresolved",
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.facts.relationToParent).toBe("UNRESOLVED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "mechanismVisible")?.state).toBe("pending");
  });

  it("fails an empty subject locally after the climb, which does not require the subject name", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const climb = buildExecutionPassPrompt({
      id: "viewerClimb",
      pillar: base.pillar,
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [],
    });
    expect(climb).toContain("missing Master Thought subject name is not a reason");
    const result = await runExecutionMeaningChecks({ ...base, masterSubject: "  ", masterSells: false, ask });
    expect(ask).toHaveBeenCalledTimes(5);
    expect(result.checks.find((check) => check.id === "subjectMatch")).toMatchObject({
      state: "fail",
      reason: "The Master Thought subject was not named.",
    });
    expect(result.checks.find((check) => check.id === "conclusionLands")?.state).toBe("pending");
    expect(result.facts.relationToParent).toBe("SUBJECT_MISMATCH");
  });

  it("keeps an older fact on the derived relation and does not store the same lesson twice", () => {
    const older = normalizeExecutionFacts({
      pillar: "Behind The Scene",
      messageAdded: true,
      mechanismVisible: true,
      pillarOutside: false,
      masterSells: false,
      viewerClimb: "CLIMBS",
      subjectMatch: "MATCH",
    });
    expect(older.meaningAudit).toBeUndefined();
    expect(older.relationToParent).toBe("MESSAGE_ADDED");
    const lesson = { checkId: "messageStays" as const, reason: "Ada klaim baru.", lines: ["Mekanismenya kelihatan."] };
    const kept = normalizeExecutionFacts({
      ...older,
      meaningAudit: { id: "messageStays", reason: "Ada klaim baru.", lineIds: ["s1-l1"] },
      relationToParent: "MESSAGE_ADDED",
      auditLessons: mergeExecutionAuditLessons([lesson], [lesson]),
    });
    expect(kept.relationToParent).toBe("MESSAGE_ADDED");
    expect(kept.meaningAudit).toEqual({ id: "messageStays", reason: "Ada klaim baru.", lineIds: ["s1-l1"] });
    expect(kept.auditLessons).toEqual([lesson]);
  });

  it("asks for one narration and includes the earlier failure", () => {
    const prompt = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      masterSubject: "Skala bahan",
      pillarName: base.pillar,
      checkId: "messageStays",
      reason: "Ada klaim baru.",
      script,
      lineIds: ["s1-l1"],
      lessons: [{ checkId: "messageStays", reason: "Ada klaim baru.", lines: ["Mekanismenya kelihatan."] }],
    });
    expect(prompt).toContain("Propose one narration replacement");
    expect(prompt).toContain("Why it failed: Ada klaim baru.");
    expect(prompt).toContain("Do not change shots");
    expect(prompt).toContain("Change only the lines that add a claim or drop the Idea's message.");
  });

  it("re-asks the failed check and the checks that have not run", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("adds no claim")) return '{"pass":true,"reason":"","lineIds":[]}';
      if (prompt.includes("another cause")) return '{"pass":false,"reason":"Sebabnya iklan.","lineIds":["s2-l1"]}';
      return '{"pass":false,"reason":"should not be asked","lineIds":["s1-l1"]}';
    });
    const result = await runExecutionOpenChecks({
      ...base,
      masterSells: false,
      prior: [
        { id: "pillarFits", state: "pass" },
        { id: "sellingFits", state: "pass" },
        { id: "mechanismVisible", state: "pass" },
        { id: "messageStays", state: "fail", reason: "Ada klaim baru.", lineIds: ["s1-l1"] },
        { id: "causeChain", state: "pending" },
        { id: "viewerClimb", state: "pending" },
        { id: "subjectMatch", state: "pending" },
        { id: "conclusionLands", state: "pending" },
      ],
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("does not force a message"))).toBe(false);
    expect(result.checks.find((check) => check.id === "messageStays")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "causeChain")).toMatchObject({
      state: "fail",
      lineIds: ["s2-l1"],
    });
    expect(result.checks.find((check) => check.id === "viewerClimb")?.state).toBe("pending");
    expect(result.passed).toBe(false);
  });

  it("rebuilds the passed checks that sit before a stored failure", () => {
    const checks = executionChecksFromAudit({
      id: "messageStays",
      reason: "Ada klaim baru.",
      lineIds: ["s1-l1"],
    });
    expect(checks.find((check) => check.id === "pillarFits")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "mechanismVisible")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "messageStays")).toMatchObject({
      state: "fail",
      lineIds: ["s1-l1"],
    });
    expect(checks.find((check) => check.id === "causeChain")?.state).toBe("pending");
    expect(
      executionFailureMoved("messageStays", [
        { id: "messageStays", state: "pass" },
        { id: "causeChain", state: "fail", reason: "Sebab lain." },
      ]),
    ).toBe(true);
    expect(
      executionFailureMoved("messageStays", [{ id: "messageStays", state: "fail", reason: "Masih klaim." }]),
    ).toBe(false);
  });

  it("passes a checklist row that still has a production issue and keeps the old rule for an older row", () => {
    expect(
      executionChecklistPassed(
        {
          pillar: "Behind The Scene",
          whatItSays: "",
          relationToParent: "VALID_EXECUTION",
          messageAdded: false,
          mechanismVisible: true,
          pillarOutside: false,
          masterSells: "unresolved",
          viewerClimb: "CLIMBS",
          subjectMatch: "MATCH",
          resolution: "RESOLVED",
          unresolvedReasons: [],
          meaningAudit: { cleared: true },
        },
        "GENERATE_VALID",
        1,
      ),
    ).toBe(true);
    expect(
      executionChecklistPassed(
        {
          pillar: "Behind The Scene",
          whatItSays: "",
          relationToParent: "VALID_EXECUTION",
          messageAdded: false,
          mechanismVisible: true,
          pillarOutside: false,
          masterSells: "unresolved",
          viewerClimb: "CLIMBS",
          subjectMatch: "MATCH",
          resolution: "RESOLVED",
          unresolvedReasons: [],
        },
        "GENERATE_VALID",
        1,
      ),
    ).toBe(false);
  });
});
