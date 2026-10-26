import { describe, expect, it } from "vitest";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { EXECUTION_PASS_CHECK_IDS } from "@/thinking-lab/execution/passChecklist";
import { admitExecution } from "@/thinking-lab/execution/policy";
import { buildExecutionJudgePrompt, deriveExecutionRelation, normalizeExecutionFacts, parseExecutionJudge } from "@/thinking-lab/execution/semantic";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

function facts(overrides: Partial<ExecutionSemanticFacts> = {}): ExecutionSemanticFacts {
  return {
    pillar: "B_ROLL_STORYTELLING",
    whatItSays: "A scene",
    relationToParent: "UNRESOLVED",
    messageAdded: false,
    mechanismVisible: true,
    pillarOutside: false,
    masterSells: "unresolved",
    viewerClimb: "CLIMBS",
    subjectMatch: "MATCH",
    resolution: "UNRESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("execution relations", () => {
  it("accepts one idea realized in a pillar without a new claim", () => {
    const row = normalizeExecutionFacts(facts());
    expect(row.relationToParent).toBe("VALID_EXECUTION");
    expect(admitExecution(row)).toBe("GENERATE_VALID");
  });

  it("rejects content that adds a claim", () => {
    expect(deriveExecutionRelation(facts({ messageAdded: true }))).toBe("MESSAGE_ADDED");
  });

  it("rejects a pillar that hides the idea mechanism", () => {
    expect(deriveExecutionRelation(facts({ mechanismVisible: false }))).toBe("MECHANISM_HIDDEN");
  });

  it("rejects a pillar that forces a message outside the idea", () => {
    expect(deriveExecutionRelation(facts({ pillarOutside: true }))).toBe("PILLAR_OUTSIDE");
  });

  it("does not reject Flash Sale from whether the Master Thought is selling", () => {
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: false }))).toBe("VALID_EXECUTION");
    expect(deriveExecutionRelation(facts({ pillar: "Flash Sale Hook", masterSells: false }))).toBe("VALID_EXECUTION");
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: true }))).toBe("VALID_EXECUTION");
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: "unresolved" }))).toBe("VALID_EXECUTION");
  });

  it("keeps a stored Flash Sale rejection after that checklist id is gone", () => {
    const row = normalizeExecutionFacts({
      pillar: "Flash Sale Hook",
      messageAdded: false,
      mechanismVisible: true,
      pillarOutside: false,
      masterSells: false,
      viewerClimb: "CLIMBS",
      subjectMatch: "MATCH",
      relationToParent: "PILLAR_NOT_SELLING",
      meaningAudit: {
        id: "sellingFits",
        reason: "Flash Sale Hook needs a Master Thought that is actually selling.",
        lineIds: [],
      },
      auditLessons: [{ checkId: "sellingFits", reason: "Lama.", lines: ["Diskon."] }],
    });
    expect(row.relationToParent).toBe("PILLAR_NOT_SELLING");
    expect(row.meaningAudit).toBeUndefined();
    expect(row.auditLessons).toBeUndefined();
    expect(admitExecution(row)).toBe("GENERATE_REJECT");
  });

  it("accepts an organization pillar outside the old four formats", () => {
    const row = normalizeExecutionFacts(facts({ pillar: "Handling Objections" }));
    expect(row.pillar).toBe("Handling Objections");
    expect(row.relationToParent).toBe("VALID_EXECUTION");
    expect(admitExecution(row)).toBe("GENERATE_VALID");
  });

  it("rejects a content whose viewer does not reach the Master Thought", () => {
    expect(deriveExecutionRelation(facts({ viewerClimb: "OTHER" }))).toBe("CLIMB_MISSED");
    expect(deriveExecutionRelation(facts({ viewerClimb: "NEGATIVE" }))).toBe("CLIMB_MISSED");
    expect(deriveExecutionRelation(facts({ subjectMatch: "OTHER" }))).toBe("VALID_EXECUTION");
  });

  it("keeps an older subject mismatch readable after that check leaves the exam", () => {
    const row = normalizeExecutionFacts({
      ...facts(),
      relationToParent: "SUBJECT_MISMATCH",
      meaningAudit: {
        id: "subjectMatch",
        reason: "Naskah menyebut nama merek.",
        lineIds: ["s1-l1"],
      },
      auditLessons: [{ checkId: "subjectMatch", reason: "Lama.", lines: ["Synckerja."] }],
    });
    expect(row.relationToParent).toBe("SUBJECT_MISMATCH");
    expect(row.meaningAudit).toBeUndefined();
    expect(row.auditLessons).toBeUndefined();
    expect(admitExecution(row)).toBe("GENERATE_REJECT");
  });

  it("stays unresolved when the job facts are missing", () => {
    const row = normalizeExecutionFacts({ pillar: "BEHIND_THE_SCENE" });
    expect(row.relationToParent).toBe("UNRESOLVED");
    expect(row.unresolvedReasons).toContain("MESSAGE_ADDED_UNRESOLVED");
    expect(row.unresolvedReasons).toContain("VIEWER_CLIMB_UNRESOLVED");
    expect(row.unresolvedReasons).not.toContain("SUBJECT_MATCH_UNRESOLVED");
  });

  it("does not block a script when the Master Thought subject was never sealed", () => {
    const row = parseExecutionJudge(
      JSON.stringify({
        messageAdded: false,
        mechanismVisible: true,
        pillarOutside: false,
        masterSells: false,
        viewerClimb: "CLIMBS",
        subjectMatch: "MATCH",
      }),
      "B_ROLL_STORYTELLING",
      false,
    );
    expect(row.relationToParent).toBe("VALID_EXECUTION");
  });

  it("names the pillar as a format, not a new meaning level", () => {
    const prompt = buildExecutionJudgePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "BACA_KOMEN_HATERS",
      candidate: "Read the comments while the courier answers.",
    });
    expect(prompt).toContain("not a new meaning level");
    expect(prompt).toContain("must not add a claim");
    expect(prompt).toContain("are not a new claim");
    expect(prompt).toContain("climb from the Idea's mechanism to the Master Thought");
    expect(prompt).not.toContain("named Master Thought subject");
    expect(prompt).not.toContain("subjectMatch");
    expect(prompt).not.toContain("Flash Sale Hook is valid only when the Master Thought is actually selling");
    expect(prompt).not.toContain("first narration sentence");
    expect(prompt).toContain("whatItSays is the explanation of this decision");
    expect(prompt).toContain("name the specific message, missing mechanism, or wrong conclusion");
    const plain = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
    });
    expect(plain).toContain("the way someone would speak it out loud");
    expect(plain).not.toContain("Do not add a claim the Idea does not already carry.");
    expect(plain).not.toContain("The call to action is one spoken invitation.");
    expect(plain).not.toContain("own conclusion scene");
    const generate = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      enabled: EXECUTION_PASS_CHECK_IDS,
    });
    expect(generate).toContain("B-Roll Storytelling");
    expect(generate).toContain("Do not add a claim");
    expect(generate).toContain("The pillar's image, label, and way of speaking may say that same Idea.");
    expect(generate).toContain("One spoken line may carry one part of the Idea.");
    expect(generate).toContain("The first narration sentence of the first story scene is the opening.");
    expect(generate).toContain("A stranger who hears only that sentence must know what situation they are in.");
    expect(generate).toContain("Do not say a brand name. The video settings did not ask for one.");
    expect(generate).not.toContain("Master Thought subject:");
    expect(generate).toContain("The opening uses this pillar's format. A list format opens as a list. A story format opens as a story.");
    expect(generate).toContain("Do not force one.");
    expect(generate).toContain("Every spoken narration line, including the opening and the call to action, is everyday speech.");
    expect(generate).toContain("Do not copy the Idea's special terms.");
    expect(generate).toContain("two short sentences about the same thing");
    expect(generate).toContain("Do not explain, define, or interpret the sign");
    expect(generate).toContain("The call to action is one spoken invitation.");
    expect(generate).toContain("Do not write a calm report.");
    expect(generate).toContain("one spoken sentence, or two short spoken sentences about the same thing");
    expect(generate).not.toContain("Make it sound like a person talking.");
    expect(generate).not.toContain("Do not explain like a speech.");
    expect(generate).toContain("A list format is a list. A story format is a story. Do not swap them.");
    expect(generate).toContain("A list is distinct items. Each spoken item says a different part of the Idea.");
    expect(generate).toContain("Repeating one point in new words fails. The format's opening word may stay the same.");
    expect(buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      speech: "silent",
    })).not.toContain("Every spoken narration line");
    expect(generate).not.toContain("Earlier failures.");
    const taught = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      enabled: ["hookHolds"],
      lessons: [{ checkId: "hookHolds", reason: "Pembukanya umum.", lines: ["Halo semua."] }],
    });
    expect(taught).toContain("Earlier failures. Do not repeat these narrations or this mistake:");
    expect(taught).toContain("hookHolds: Halo semua.");
    expect(taught).toContain("Why it failed: Pembukanya umum.");
    expect(generate).toContain("Big Thought's stake happen");
    expect(generate).toContain("not an advertisement");
    expect(generate).toContain("own conclusion scene");
    expect(generate).toContain("do not hide it");
    expect(generate).toContain("Do not stop at the mechanism");
    expect(generate).toContain("voice-over script");
    expect(generate).toContain("scenes");
    expect(generate).toContain("more than one shot");
    expect(generate).toContain("one spoken sentence");
    expect(generate).toContain("best post title");
    expect(generate).toContain("feel spoken");
    expect(generate).toContain("click-through");
    expect(generate).toContain("does not retell");
    expect(generate).toContain("hashtags");
    expect(generate).not.toContain("Speech mode");
    expect(generate).not.toContain("Fit the narration");
    expect(generate).toContain("also names a @location token");
    const dialog = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      speech: "dialog",
    });
    expect(dialog).toContain("on-screen dialogue only");
    expect(dialog).toContain("counterpart");
    expect(dialog).toContain('@character_example said: "the narration sentence, unchanged"');
    expect(dialog).toContain("at least three shots");
    const mix = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      speech: "mix",
    });
    expect(mix).toContain("must contain both kinds");
    expect(mix).toContain("said:");
    const silent = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      speech: "silent",
    });
    expect(silent).toContain("unspoken beat");
    expect(silent).toContain("at least three shots");
    expect(silent).toContain("several sentences");
    expect(silent).not.toContain("one spoken sentence");
  });

  it("fits the narration to a set duration", () => {
    const generate = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      durationSeconds: 30,
    });
    expect(generate).toContain("Fit the narration to about 30 seconds, about 66 words.");
    expect(generate).toContain("Do not make the script much shorter or much longer than that.");
  });

  it("asks every speech mode to say the brand name when one is set", () => {
    const base = {
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
      brandName: "Vialdi Wedding",
    };
    for (const speech of ["vo", "mix", "dialog", "silent"] as const) {
      const prompt = buildExecutionGeneratePrompt({ ...base, speech });
      expect(prompt).toContain('The script must mention this brand name exactly: "Vialdi Wedding".');
    }
    expect(buildExecutionGeneratePrompt({ ...base, speech: "silent" })).toContain("readable text");
    expect(buildExecutionGeneratePrompt({ ...base, speech: "dialog" })).toContain("A character says the brand name");
    const withCta = buildExecutionGeneratePrompt({ ...base, speech: "vo", cta: "Follow Akun Ini" });
    expect(withCta).toContain('The video settings chose this action: "Follow Akun Ini".');
    expect(withCta).toContain("Do not put the call to action in the conclusion");
    expect(withCta).toContain("Do not make the scene only the settings label.");
    expect(withCta).not.toContain("using this exact phrase");
    expect(
      buildExecutionGeneratePrompt({
        masterStatement: base.masterStatement,
        ideaStatement: base.ideaStatement,
        pillar: base.pillar,
      }),
    ).toContain("or brand");
  });
});
