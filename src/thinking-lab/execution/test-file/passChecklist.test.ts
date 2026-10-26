import { describe, expect, it, vi } from "vitest";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { normalizeExecutionFacts } from "@/thinking-lab/execution/semantic";
import { pillarNeedsRecommendation } from "@/thinking-lab/execution/recommend";
import {
  applyPassSwitchScript,
  buildExecutionMeaningRepairPrompt,
  buildExecutionPassPrompt,
  buildPassSwitchRewritePrompt,
  checksImplementedBySwitch,
  emptyExecutionPassChecklist,
  ensureVideoPassChecks,
  buildNarrationLineRegeneratePrompt,
  EXECUTION_PASS_CHECK_IDS,
  executionChecklistPassed,
  executionChecksFromAudit,
  executionFailureMoved,
  factsForPassChecks,
  regeneratePassPrior,
  togglePassCheck,
  meaningLineRepairReady,
  parseExecutionPassCheck,
  mergeExecutionAuditLessons,
  narrationChangeRows,
  passSwitchOutcome,
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

const everyCheckOn = EXECUTION_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" as const, enabled: true }));

describe("execution pass checklist", () => {
  it("stops at the first failed check and does not ask for another pillar after a new claim", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("adds no claim")) return '{"pass":false,"reason":"Ada klaim baru.","lineIds":["s1-l1"]}';
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({ ...base, masterSells: "unknown", prior: everyCheckOn, ask });
    expect(ask).toHaveBeenCalledTimes(7);
    expect(result.facts.relationToParent).toBe("MESSAGE_ADDED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "soundsSpoken")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "messageStays")?.state).toBe("fail");
    expect(result.checks.find((check) => check.id === "causeChain")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "emotionalTone")?.state).toBe("pending");
  });

  it("fails a missing opening without a model and does not ask for another pillar", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const empty: VoiceOverScript = {
      ...script,
      scenes: [{ id: "cta", title: "Ajak", purpose: "cta", lines: [{ id: "cta-l1", narration: "Follow akun ini.", shots: [] }] }],
    };
    const result = await runExecutionMeaningChecks({ ...base, script: empty, masterSells: false, prior: everyCheckOn, ask });
    expect(ask).not.toHaveBeenCalled();
    expect(result.checks.find((check) => check.id === "hookHolds")).toMatchObject({
      state: "fail",
      reason: "The first narration sentence is missing.",
      lineIds: [],
    });
    expect(result.facts.relationToParent).toBe("HOOK_MISSED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "pillarFits")).toMatchObject({ state: "pending", enabled: true });
    expect(result.checks.find((check) => check.id === "soundsSpoken")).toMatchObject({ state: "pending", enabled: true });
  });

  it("stops at a failed opening and keeps the first line when the model omits its id", async () => {
    const ask = vi.fn(async () => '{"pass":false,"reason":"Pembukanya umum.","lineIds":[]}');
    const result = await runExecutionMeaningChecks({ ...base, pillar: "Flash Sale Hook", masterSells: false, prior: everyCheckOn, ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.checks.find((check) => check.id === "hookHolds")).toMatchObject({
      state: "fail",
      reason: "Pembukanya umum.",
      lineIds: ["s1-l1"],
    });
    expect(result.facts.relationToParent).toBe("HOOK_MISSED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "pillarFits")).toMatchObject({ state: "pending", enabled: true });
  });

  it("fails a stiff spoken line and does not ask the pillar yet", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("spoken narration lines")) return '{"pass":false,"reason":"Seperti pidato.","lineIds":["s2-l1"]}';
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({ ...base, masterSells: false, prior: everyCheckOn, ask });
    const spokenPrompt = String(ask.mock.calls[1]?.[0] ?? "");
    expect(spokenPrompt).toContain("Mekanismenya kelihatan.");
    expect(spokenPrompt).toContain("Hematnya jadi kelihatan.");
    expect(spokenPrompt).toContain("Everyday words are enough.");
    expect(spokenPrompt).toContain("two short sentences about the same thing");
    expect(spokenPrompt).toContain("only names a result that cannot be pointed at");
    expect(spokenPrompt).toContain("announces the speaker's method of looking");
    expect(spokenPrompt).toContain("explains, defines, or interprets the sign");
    expect(spokenPrompt).toContain("sounds like a presentation");
    expect(spokenPrompt).toContain("any spoken line is a formal address or a list of what a product can do");
    expect(spokenPrompt).toContain("The call to action is one spoken invitation.");
    expect(spokenPrompt).toContain("everyday words for that same shape");
    expect(spokenPrompt).toContain("A calm sentence still fails when it reads like a report.");
    expect(spokenPrompt).not.toContain("Do not fail because the line states the Idea, because the words are calm");
    expect(spokenPrompt).not.toContain("A list item or a story line can pass");
    expect(spokenPrompt).not.toContain("Do not fail the closing lines because they name a product");
    expect(spokenPrompt).not.toContain("kontribusi kolektif");
    expect(spokenPrompt).not.toContain("the person it happens to");
    expect(String(ask.mock.calls[0]?.[0] ?? "")).not.toContain("explains like a speech");
    expect(result.checks.find((check) => check.id === "soundsSpoken")).toMatchObject({
      state: "fail",
      lineIds: ["s2-l1"],
    });
    expect(result.facts.relationToParent).toBe("SPEECH_STIFF");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "pillarFits")).toMatchObject({ state: "pending", enabled: true });
  });

  it("passes spoken style without a model when nothing is spoken", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("spoken narration lines")) return '{"pass":false,"reason":"should not be asked","lineIds":["s1-l1"]}';
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({
      ...base,
      script: { ...script, speech: "silent" },
      masterSells: false,
      prior: everyCheckOn,
      ask,
    });
    expect(result.checks.find((check) => check.id === "soundsSpoken")?.state).toBe("pass");
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("spoken narration lines"))).toBe(false);
  });

  it("fails a story written under a list pillar and does not recommend another pillar", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("must be written in that format")) {
        return '{"pass":false,"reason":"Ini cerita, bukan daftar.","lineIds":[]}';
      }
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({
      ...base,
      pillar: "Do's and Don'ts",
      pillarCategory: "LISTICLE & CHEAT SHEET",
      pillarDescription: "Daftar yang boleh dan yang tidak boleh.",
      masterSells: false,
      prior: everyCheckOn,
      ask,
    });
    expect(result.facts.relationToParent).toBe("FORMAT_MISSED");
    expect(pillarNeedsRecommendation(result.facts.relationToParent)).toBe(false);
    expect(result.checks.find((check) => check.id === "formatHolds")).toMatchObject({
      state: "fail",
      lineIds: ["s1-l1", "s2-l1"],
    });
    expect(result.checks.find((check) => check.id === "mechanismVisible")?.state).toBe("pending");
    const prompt = String(ask.mock.calls.find(([text]) => String(text).includes("must be written in that format"))?.[0] ?? "");
    expect(prompt).toContain("LISTICLE & CHEAT SHEET");
    expect(prompt).toContain("Daftar yang boleh dan yang tidak boleh.");
    expect(prompt).toContain("pass is false when list items repeat one point in new words.");
    expect(prompt).toContain("repeated point");
  });

  it("sends a repeated list back to a full rewrite", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("must be written in that format")) {
        return '{"pass":false,"reason":"Butirnya mengulang satu larangan.","lineIds":["s1-l1","s2-l1"],"repeat":true}';
      }
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const result = await runExecutionMeaningChecks({
      ...base,
      pillar: "Education - The 'Stop Doing This'",
      masterSells: false,
      prior: everyCheckOn,
      ask,
    });
    expect(result.facts.relationToParent).toBe("FORMAT_MISSED");
    expect(result.checks.find((check) => check.id === "formatHolds")).toMatchObject({
      state: "fail",
      lineIds: [],
    });
    expect(meaningLineRepairReady(result.facts)).toBe(false);
  });

  it("judges only the first story sentence and keeps earlier lessons", async () => {
    const ask = vi.fn(async () => '{"pass":false,"reason":"Pembukanya umum.","lineIds":["s1-l1"]}');
    const scoped: VoiceOverScript = {
      ...script,
      title: "Judul feed",
      caption: "Caption feed",
      scenes: [
        {
          id: "s1",
          title: "Buka",
          lines: [
            { id: "s1-l1", narration: "Grafiknya naik.", shots: [] },
            { id: "s1-l2", narration: "Kolomnya kosong.", shots: [] },
          ],
        },
        { id: "s2", title: "Tutup", lines: [{ id: "s2-l1", narration: "Kesimpulannya.", shots: [] }] },
        { id: "s3", title: "Ajak", purpose: "cta", lines: [{ id: "s3-l1", narration: "Follow akun ini.", shots: [] }] },
      ],
    };
    const older = [{ checkId: "messageStays" as const, reason: "Ada klaim baru.", lines: ["Klaim lama."] }];
    const result = await runExecutionMeaningChecks({
      ...base,
      script: scoped,
      masterSells: false,
      auditLessons: older,
      prior: everyCheckOn,
      ask,
    });
    const hookPrompt = String(ask.mock.calls[0]?.[0] ?? "");
    expect(hookPrompt).toContain("Grafiknya naik.");
    expect(hookPrompt).not.toContain("Kolomnya kosong.");
    expect(hookPrompt).not.toContain("Kesimpulannya.");
    expect(hookPrompt).not.toContain("Follow akun ini.");
    expect(hookPrompt).not.toContain("Judul feed");
    expect(hookPrompt).not.toContain("Caption feed");
    expect(result.facts.auditLessons).toEqual(older);
    const lesson = { checkId: "hookHolds" as const, reason: "Pembukanya umum.", lines: ["Grafiknya naik."] };
    expect(mergeExecutionAuditLessons(result.facts.auditLessons ?? [], [lesson, lesson])).toEqual([...older, lesson]);
  });

  it("does not ask about the Master Thought subject, even when that name is missing", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const climb = buildExecutionPassPrompt({
      id: "viewerClimb",
      pillar: base.pillar,
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [],
    });
    expect(climb).toContain("missing Master Thought subject name is not a reason");
    expect(climb).not.toContain("named subject");
    const quiet = await runExecutionMeaningChecks({ ...base, masterSubject: "  ", masterSells: false, ask });
    expect(ask).not.toHaveBeenCalled();
    expect(quiet.checks.every((check) => check.enabled === false)).toBe(true);
    expect(quiet.facts.relationToParent).toBe("VALID_EXECUTION");
    const result = await runExecutionMeaningChecks({ ...base, masterSubject: "  ", masterSells: false, prior: everyCheckOn, ask });
    expect(ask).toHaveBeenCalledTimes(EXECUTION_PASS_CHECK_IDS.length);
    expect(result.checks.filter((check) => check.enabled !== false).map((check) => check.id)).toEqual([...EXECUTION_PASS_CHECK_IDS]);
    expect(result.facts.passChecks?.find((check) => check.id === "formatHolds")?.enabled).toBe(true);
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("named subject"))).toBe(false);
  });

  it("treats a stored closing-line failure as already passed", () => {
    const facts = normalizeExecutionFacts({
      pillar: "Red Flags",
      relationToParent: "CONCLUSION_MISSED",
      messageAdded: false,
      mechanismVisible: true,
      pillarOutside: false,
      masterSells: false,
      viewerClimb: "CLIMBS",
      subjectMatch: "MATCH",
      resolution: "RESOLVED",
      meaningAudit: { id: "conclusionLands", reason: "Penutupnya belum mendarat.", lineIds: ["s5-l1"] },
      passChecks: [
        { id: "hookHolds", state: "pass", enabled: true },
        { id: "conclusionLands", state: "fail", enabled: true, reason: "Penutupnya belum mendarat." },
      ],
    });
    expect(facts.relationToParent).toBe("VALID_EXECUTION");
    expect(facts.meaningAudit).toEqual({ cleared: true });
    expect(facts.passChecks?.map((check) => check.id).join(" ")).not.toContain("conclusionLands");
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
    const letter = "Sebelum les tambahan, tanyakan satu hal kecil yang ingin mereka rasakan sekarang.";
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
    expect(prompt).toContain("Keep this pillar's image, label, and way of speaking when the Idea stays the same.");
    expect(prompt).toContain("Do not rewrite it only because it does not repeat the whole Idea.");
    expect(prompt).not.toContain("Locked pillar communication:");
    const boundedRepair = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: "Letter to Younger Self",
      pillarDevelopment: letter,
      checkId: "messageStays",
      reason: "Ada klaim baru.",
      script: {
        ...script,
        decisions: [{ category: "Momen", question: "Apa yang terlihat?", answer: "Anak sedang bermain game.", binds: "story" }],
      },
      lineIds: ["s1-l1"],
      lessons: [],
    });
    expect(boundedRepair).toContain("Locked pillar communication:");
    expect(boundedRepair).toContain(letter);
    expect(boundedRepair).toContain("Anak sedang bermain game.");
    expect(boundedRepair).toContain("saat itu aku mulai bertanya");
    expect(boundedRepair).toContain("ibu yang baik sedunia");
    const openingRewrite = buildNarrationLineRegeneratePrompt({
      lineId: "s2-l1",
      enabled: ["hookHolds", "soundsSpoken", "messageStays"],
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: "Letter to Younger Self",
      pillarDevelopment: letter,
      script: {
        ...script,
        decisions: [{ category: "Momen", question: "Apa yang terlihat?", answer: "Anak sedang bermain game.", binds: "story" }],
      },
    });
    expect(openingRewrite).toContain("locked story answer is not a new claim");
    expect(openingRewrite).toContain(letter);
    expect(openingRewrite).toContain("Anak sedang bermain game.");
    expect(openingRewrite).toContain("as a memory of it already having happened");
    expect(openingRewrite).toContain("andai saja aku tahu");
    const claim = buildExecutionPassPrompt({
      id: "messageStays",
      pillar: base.pillar,
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [{ id: "s1-l1", narration: "Mekanismenya kelihatan." }],
    });
    expect(claim).toContain("adds no claim");
    expect(claim).toContain("does not have to repeat the experiment, the condition, and the consequence");
    expect(claim).toContain("will never be identified");
    expect(claim).not.toContain("Locked pillar communication:");
    const bounded = buildExecutionPassPrompt({
      id: "messageStays",
      pillar: "Letter to Younger Self",
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      pillarDevelopment: letter,
      decisions: [
        { category: "Momen", question: "Apa yang terlihat sebelum pertanyaan?", answer: "Anak sedang bermain game.", binds: "story" },
        { category: "Sudut", question: "Siapa yang berbicara?", answer: "Ibu yang lebih tua.", binds: "viewpoint" },
        { category: "Kamera", question: "Apa yang dipegang kamera?", answer: "Meja makan.", binds: "frame" },
      ],
      lines: [{ id: "s1-l1", narration: "Anak-anakmu asyik dengan game mereka." }],
    });
    expect(bounded).toContain("Locked pillar communication:");
    expect(bounded).toContain(letter);
    expect(bounded).toContain('Locked story answer — Momen: "Anak sedang bermain game."');
    expect(bounded).not.toContain("Ibu yang lebih tua.");
    expect(bounded).not.toContain("Meja makan.");
    expect(bounded).toContain("is a new claim unless a locked story answer names it.");
    expect(bounded).toContain("A line that says andai saja aku tahu, followed by a line that says saat itu aku mulai bertanya, is that failure.");
    expect(bounded).toContain("A smile, or the words ibu yang baik sedunia, is a new claim when the locked pillar communication does not state them.");
    const shape = buildExecutionPassPrompt({
      id: "formatHolds",
      pillar: "Letter to Younger Self",
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      pillarDevelopment: letter,
      lines: [{ id: "s1-l1", narration: "Anak-anakmu asyik dengan game mereka." }],
    });
    expect(shape).not.toContain("Locked pillar communication:");
    const hookRepair = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      checkId: "hookHolds",
      reason: "Pembukanya umum.",
      script,
      lineIds: ["s1-l1"],
      lessons: [],
    });
    expect(hookRepair).toContain("A stranger who hears only that sentence must know what situation they are in.");
    expect(hookRepair).toContain("The sentence must stop making sense if that problem is removed.");
    expect(hookRepair).toContain("A question or a what-if is allowed only when that shape is this pillar's format. Do not force one.");
    const spokenRepair = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      checkId: "soundsSpoken",
      reason: "Seperti pidato.",
      script,
      lineIds: ["s2-l1"],
      lessons: [],
    });
    expect(spokenRepair).toContain("Rewrite the stiff lines as everyday speech.");
    expect(spokenRepair).toContain("two short sentences about the same thing");
    expect(spokenRepair).toContain("Do not explain, define, or interpret the sign");
    expect(spokenRepair).toContain("The call to action is one spoken invitation.");
    expect(spokenRepair).toContain("Do not write a calm report.");
    expect(spokenRepair).toContain("Do not copy the Idea's special terms.");
    const formatRepair = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: "Do's and Don'ts",
      pillarCategory: "LISTICLE & CHEAT SHEET",
      checkId: "formatHolds",
      reason: "Ini cerita, bukan daftar.",
      script,
      lineIds: ["s1-l1", "s2-l1"],
      lessons: [],
    });
    expect(formatRepair).toContain("Rewrite the named lines so the spoken script uses this pillar's format.");
    expect(formatRepair).toContain("Each list item says a different part of the Idea.");
    expect(formatRepair).toContain("LISTICLE & CHEAT SHEET");
  });

  it("rewrites one line under only the requirements that are switched on", () => {
    const opening = buildNarrationLineRegeneratePrompt({
      lineId: "s1-l1",
      enabled: ["hookHolds", "soundsSpoken"],
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      script,
    });
    expect(opening).toContain("Rewrite only this narration line.");
    expect(opening).toContain("s1-l1: Mekanismenya kelihatan.");
    expect(opening).toContain("This line is the first narration sentence.");
    expect(opening).toContain("Write this line as everyday speech.");
    expect(opening).not.toContain("Do not add a claim");
    const later = buildNarrationLineRegeneratePrompt({
      lineId: "s2-l1",
      enabled: ["hookHolds", "soundsSpoken", "messageStays"],
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: "Do's and Don'ts",
      pillarCategory: "LISTICLE & CHEAT SHEET",
      script,
      refused: ["Hematnya jadi kelihatan."],
    });
    expect(later).toContain("Line before:\ns1-l1: Mekanismenya kelihatan.");
    expect(later).toContain("Do not add a claim, a solution, a need, or a consequence the Idea does not carry.");
    expect(later).not.toContain("This line is the first narration sentence.");
    expect(later).toContain("Do not return any of these narrations:\nHematnya jadi kelihatan.");
    const invitation = buildNarrationLineRegeneratePrompt({
      lineId: "cta-l1",
      enabled: ["soundsSpoken", "formatHolds"],
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      script: {
        ...script,
        scenes: [...script.scenes, { id: "cta", title: "Ajak", purpose: "cta", lines: [{ id: "cta-l1", narration: "Follow akun ini.", shots: [] }] }],
      },
    });
    expect(invitation).toContain("The call to action is one spoken invitation.");
    expect(invitation).not.toContain("The spoken line uses this pillar's format.");
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
        { id: "hookHolds", state: "pass" },
        { id: "soundsSpoken", state: "pass" },
        { id: "pillarFits", state: "pass" },
        { id: "formatHolds", state: "pass" },
        { id: "mechanismVisible", state: "pass" },
        { id: "messageStays", state: "fail", reason: "Ada klaim baru.", lineIds: ["s1-l1"] },
        { id: "causeChain", state: "pending" },
        { id: "viewerClimb", state: "pending" },
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
    expect(checks.find((check) => check.id === "hookHolds")).toMatchObject({ state: "pass", enabled: false });
    expect(checks.find((check) => check.id === "soundsSpoken")).toMatchObject({ state: "pass", enabled: false });
    expect(checks.find((check) => check.id === "pillarFits")).toMatchObject({ state: "pass", enabled: false });
    expect(checks.find((check) => check.id === "formatHolds")).toMatchObject({ state: "pass", enabled: false });
    expect(checks.find((check) => check.id === "mechanismVisible")).toMatchObject({ state: "pass", enabled: false });
    expect(checks.find((check) => check.id === "messageStays")).toMatchObject({
      state: "fail",
      enabled: true,
      lineIds: ["s1-l1"],
    });
    expect(checks.find((check) => check.id === "causeChain")).toMatchObject({ state: "pass", enabled: false });
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

  it("reads a list of passed slides as one pass", () => {
    const known = new Set(["s1-l1", "s2-l1", "s3-l1", "s4-l1", "s5-l1"]);
    const script = JSON.stringify([
      { pass: true, reason: "", lineIds: ["s1-l1"] },
      { pass: true, reason: "", lineIds: ["s2-l1"] },
      { pass: true, reason: "", lineIds: ["s3-l1"] },
      { pass: true, reason: "", lineIds: ["s4-l1"] },
      { pass: true, reason: "", lineIds: ["s5-l1"] },
    ]);
    expect(parseExecutionPassCheck(script, known)).toEqual({ pass: true, reason: "", lineIds: [], repeat: false });
    expect(
      parseExecutionPassCheck(
        JSON.stringify([
          { pass: true, reason: "", lineIds: ["s1-l1"] },
          { pass: false, reason: "Headline ada di gambar.", lineIds: ["s4-l1"] },
        ]),
        known,
      ),
    ).toEqual({ pass: false, reason: "Headline ada di gambar.", lineIds: ["s4-l1"], repeat: false });
  });

  it("audits only a requirement that is switched back on after the rest passed", () => {
    const passed = [
      { id: "hookHolds" as const, state: "pass" as const },
      { id: "soundsSpoken" as const, state: "pass" as const },
      { id: "emotionalTone" as const, state: "pass" as const, enabled: false },
    ];
    const off = togglePassCheck(passed, "soundsSpoken", false);
    expect(off.audit).toBe(false);
    expect(off.checks.find((check) => check.id === "soundsSpoken")?.enabled).toBe(false);
    const on = togglePassCheck(off.checks, "emotionalTone", true);
    expect(on.audit).toBe(true);
    expect(on.checks.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(on.checks.find((check) => check.id === "emotionalTone")?.state).toBe("pending");
    const facts = factsForPassChecks(
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
      off.checks,
    );
    expect(facts.relationToParent).toBe("VALID_EXECUTION");
    expect(executionChecklistPassed(facts, "GENERATE_VALID", 0)).toBe(true);
    const kept = normalizeExecutionFacts(facts);
    expect(kept.passChecks?.find((check) => check.id === "soundsSpoken")?.enabled).toBe(false);
  });

  it("asks for the person who bears the stake and leaves that check off on an older pass", async () => {
    const tone = buildExecutionPassPrompt({
      id: "emotionalTone",
      pillar: base.pillar,
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [{ id: "s1-l1", narration: "Mekanismenya kelihatan." }],
    });
    expect(tone).toContain("the person it happens to");
    expect(tone).toContain("Someone who says saya berpikir or saya sadar is not that person.");
    expect(tone).not.toContain("whose record is zero because the count already closed");
    expect(tone).not.toContain("bagaimana saya mengukur");
    expect(tone).toContain("The first line does not have to be that person.");
    expect(tone).not.toContain("can only set the scene");
    expect(tone).toContain("Do not fail because the words are calm");
    expect(tone).not.toContain("Follow akun ini.");
    const written = buildExecutionGeneratePrompt({
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      pillar: base.pillar,
      enabled: ["emotionalTone", "hookHolds"],
    });
    expect(written).toContain("the person it happens to");
    expect(written).toContain("Someone who only asks how it works is not that person.");
    expect(written).toContain("unless that question is this pillar's format");
    const hook = buildExecutionPassPrompt({
      id: "hookHolds",
      pillar: "Did You Know?",
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [{ id: "s1-l1", narration: "Did you know the count already closed?" }],
    });
    expect(hook).toContain("and that question is not this pillar's format");
    const mechanism = buildExecutionPassPrompt({
      id: "mechanismVisible",
      pillar: base.pillar,
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      lines: [{ id: "s1-l1", narration: "Mekanismenya kelihatan." }],
    });
    expect(mechanism).not.toContain("can see the Idea's mechanism");
    expect(mechanism).toContain("the format hides the mechanism");
    expect(mechanism).toContain("merely unstated");
    const repair = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      checkId: "emotionalTone",
      reason: "Narasi hanya menjelaskan sistemnya.",
      script,
      lineIds: ["s1-l1"],
      lessons: [],
    });
    expect(repair).toContain("Rewrite only the named line.");
    expect(repair).toContain("Do not leave the line as someone asking how it works.");
    expect(repair).toContain("Do not add a claim, a product, a brand, a company, or a solution the Idea does not carry.");
    expect(pillarNeedsRecommendation("PERSON_MISSED")).toBe(false);
    const older = executionChecksFromAudit({ cleared: true });
    expect(older.find((check) => check.id === "emotionalTone")).toMatchObject({ state: "pass", enabled: false });
    expect(older.find((check) => check.id === "hookHolds")).toMatchObject({ state: "pass", enabled: false });
    expect(older.find((check) => check.id === "soundsSpoken")).toMatchObject({ state: "pass", enabled: false });
    expect(older.filter((check) => check.enabled !== false)).toEqual([]);
    expect(older.map((check) => check.id).join(" ")).not.toContain("conclusionLands");
    expect(
      executionChecklistPassed(
        {
          pillar: base.pillar,
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
        0,
      ),
    ).toBe(true);
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("the person it happens to")) return '{"pass":true,"reason":"","lineIds":[]}';
      return '{"pass":false,"reason":"should not be asked","lineIds":["s1-l1"]}';
    });
    const prior = older.map((check) =>
      check.id === "emotionalTone" ? { ...check, state: "pending" as const, enabled: true } : { ...check, enabled: true },
    );
    const result = await runExecutionOpenChecks({ ...base, masterSells: false, prior, ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.checks.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "emotionalTone")?.state).toBe("pass");
    expect(result.checks.map((check) => check.id).join(" ")).not.toContain("conclusionLands");
    expect(result.facts.relationToParent).toBe("VALID_EXECUTION");
  });

  it("keeps the last switch when a script is regenerated", () => {
    const turnedOff = togglePassCheck(
      [
        { id: "hookHolds", state: "pass", enabled: true },
        { id: "messageStays", state: "pass", enabled: false },
      ],
      "hookHolds",
      false,
    );
    const turnedOn = togglePassCheck(turnedOff.checks, "messageStays", true);
    const prior = regeneratePassPrior(turnedOn.checks);
    expect(prior.find((check) => check.id === "hookHolds")).toMatchObject({ state: "pass", enabled: false });
    expect(prior.find((check) => check.id === "messageStays")).toMatchObject({ state: "pending", enabled: true });
    expect(prior.find((check) => check.id === "emotionalTone")).toMatchObject({ state: "pass", enabled: false });
  });

  it("keeps slang off until its switch is on", () => {
    expect(emptyExecutionPassChecklist().find((check) => check.id === "usesSlang")).toMatchObject({ state: "pass", enabled: false });
    const older = ensureVideoPassChecks([
      { id: "hookHolds", state: "pass", enabled: true },
      { id: "soundsSpoken", state: "pass", enabled: false },
      { id: "pillarFits", state: "pass", enabled: false },
    ]);
    expect(older.map((check) => check.id)).toEqual([...EXECUTION_PASS_CHECK_IDS]);
    expect(older.find((check) => check.id === "usesSlang")).toMatchObject({ state: "pass", enabled: false });
    expect(older.find((check) => check.id === "hookHolds")).toMatchObject({ state: "pass", enabled: true });
    expect(pillarNeedsRecommendation("SLANG_MISSED")).toBe(false);
    const plain = buildExecutionGeneratePrompt({
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      pillar: base.pillar,
      speech: "on_camera",
      pillarDevelopment: "Tiga langkah.",
    });
    expect(plain).not.toContain("Write every spoken line in slang");
    const slang = buildExecutionGeneratePrompt({
      masterStatement: base.masterStatement,
      ideaStatement: base.ideaStatement,
      pillar: base.pillar,
      speech: "on_camera",
      pillarDevelopment: "Tiga langkah.",
      enabled: ["usesSlang"],
    });
    expect(slang).toContain("Write every spoken line in slang the audience would actually say.");
    expect(slang).toContain("nggak, sih, deh, kok, dong, aja, and banget");
    expect(slang).toContain("Keep the step the locked pillar communication already wrote.");
    const judged = buildExecutionPassPrompt({
      id: "usesSlang",
      pillar: "B_ROLL_STORYTELLING",
      masterStatement: "M",
      ideaStatement: "I",
      ancestors: [],
      lines: [{ id: "a", narration: "Namun hal ini sangat penting." }],
    });
    expect(judged).toContain("pass is false when the line uses a formal connector");
    expect(judged).toContain("Do not fail because the line is calm");
    const repaired = buildExecutionMeaningRepairPrompt({
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      checkId: "usesSlang",
      reason: "A line is formal.",
      script,
      lineIds: ["s1-l1"],
      lessons: [],
    });
    expect(repaired).toContain("Rewrite the named lines into slang");
  });

  it("shows a before and after only for lines a switch rewrite changes", () => {
    const shared = {
      ideaStatement: base.ideaStatement,
      masterStatement: base.masterStatement,
      pillarName: base.pillar,
      lines: [
        { id: "s1-l1", narration: "Hal ini sangat penting." },
        { id: "s2-l1", narration: "Hematnya jadi kelihatan." },
      ],
    };
    const turnedOn = buildPassSwitchRewritePrompt({
      ...shared,
      checkId: "usesSlang",
      enabled: true,
      enabledIds: ["usesSlang", "soundsSpoken"],
      surface: "video",
    });
    expect(turnedOn).toContain("The requirement usesSlang was just switched on.");
    expect(turnedOn).toContain("Write the narration so every requirement that is switched on is already true, including the one just switched on.");
    expect(turnedOn).toContain("Write every spoken line in slang the audience would actually say.");
    expect(turnedOn).toContain("Every spoken line is everyday speech.");
    expect(turnedOn).not.toContain("Change only a line that does not yet satisfy the requirement that was just switched on.");
    const turnedOff = buildPassSwitchRewritePrompt({
      ...shared,
      checkId: "usesSlang",
      enabled: false,
      enabledIds: ["soundsSpoken"],
      surface: "video",
    });
    expect(turnedOff).toContain("The requirement usesSlang was just switched off.");
    expect(turnedOff).toContain("without slang particles");
    expect(turnedOff).not.toContain("Write every spoken line in slang the audience would actually say.");
    expect(turnedOff).toContain("Every spoken line is everyday speech.");
    const changes = narrationChangeRows(shared.lines, [
      { id: "s1-l1", narration: "Hal ini penting banget." },
      { id: "s2-l1", narration: "Hematnya jadi kelihatan." },
    ]);
    expect(changes.map((change) => change.lineId)).toEqual(["s1-l1"]);
    expect(changes[0]?.beforeWords.find((word) => word.text === "sangat")?.changed).toBe(true);
    expect(changes[0]?.afterWords.find((word) => word.text === "banget.")?.changed).toBe(true);
    expect(changes[0]?.afterWords.find((word) => word.text === "Hal")?.changed).toBe(false);
    expect(passSwitchOutcome(changes)).toBe("propose");
    expect(passSwitchOutcome([])).toBe("save-switch");
    expect(checksImplementedBySwitch([
      { id: "soundsSpoken", state: "fail", enabled: true, reason: "A line sounds like a report." },
      { id: "usesSlang", state: "pending", enabled: true },
      { id: "hookHolds", state: "pass", enabled: false },
    ])).toEqual([
      { id: "soundsSpoken", state: "pass", enabled: true },
      { id: "usesSlang", state: "pass", enabled: true },
      { id: "hookHolds", state: "pass", enabled: false },
    ]);
    const next = applyPassSwitchScript(script, [{ lineId: "s1-l1", narration: "Hal ini penting banget." }]);
    expect(next.scenes[0]?.lines[0]?.narration).toBe("Hal ini penting banget.");
    expect(script.scenes[0]?.lines[0]?.narration).toBe("Mekanismenya kelihatan.");
    expect(applyPassSwitchScript(script, [{ lineId: "caption", narration: "Caption baru." }]).caption).toBe("Caption baru.");
  });
});
