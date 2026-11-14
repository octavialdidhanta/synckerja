import { describe, expect, it } from "vitest";
import { IDEA_CHECK_IDS } from "@/thinking-lab/idea/check/ids";
import { buildIdeaCheckPrompt, runIdeaChecks } from "@/thinking-lab/idea/check/run";

const base = {
  statement: "Kita ajak dua orang mencicipi sate tanpa tahu cara bakarnya sehingga beda rasanya datang dari bara.",
  angle: "Orang menyalahkan bumbu waktu sate keras, padahal masalahnya di api.",
  territory: "Bakar-bakaran malam tahun baru",
  bigThought: "karena bara yang stabil mematangkan daging merata",
  masterThought: "Rasa sate lebih ditentukan cara dibakar daripada bumbunya.",
  masterSubject: "cara sate dibakar",
  mechanismKeys: [{ otherExplanation: "Dagingnya beda", close: "Dipotong dari bagian yang sama" }],
  failures: [],
  peers: [],
  historyAvailable: true,
};

/** Answers every batched check with pass unless listed in fail; a single check the same way. */
function model(fail: Record<string, string> = {}) {
  const asked: string[] = [];
  const ask = async (prompt: string) => {
    const listed = /check id: ([^\n]+)\./.exec(prompt);
    if (listed) {
      const ids = listed[1].split(", ");
      asked.push(...ids);
      return JSON.stringify({ checks: ids.map((id) => ({ id, pass: !fail[id], reason: fail[id] ?? "" })) });
    }
    const one = /Decide the Idea check (\w+)\./.exec(prompt)?.[1] ?? "";
    asked.push(one);
    return JSON.stringify(fail[one] ? { pass: false, reason: fail[one] } : { pass: true, reason: "" });
  };
  return { ask, asked };
}

const statusOf = (result: Awaited<ReturnType<typeof runIdeaChecks>>, id: string) =>
  result.criteria.find((row) => row.id === id)?.status;

describe("Idea checks", () => {
  it("runs the seven checks in one batched call and passes", async () => {
    const m = model();
    const result = await runIdeaChecks({ ...base, ask: m.ask });
    expect(result.decision).toBe("LOLOS");
    expect(result.criteria.map((row) => row.id)).toEqual([...IDEA_CHECK_IDS]);
    // distinct is decided in code while no other Idea has passed.
    expect(m.asked).toEqual(["proposal", "mechanism", "result", "stakeHolds", "causeLock", "watchable"]);
  });

  it("stops at the first failed check and leaves the later ones unchecked", async () => {
    const m = model({ mechanism: "Ini masih pengamatan, belum mekanisme." });
    const result = await runIdeaChecks({ ...base, ask: m.ask });
    expect(result.decision).toBe("DITOLAK");
    expect(statusOf(result, "proposal")).toBe("PASS");
    expect(statusOf(result, "mechanism")).toBe("FAIL");
    expect(statusOf(result, "result")).toBe("BELUM_TERVERIFIKASI");
    expect(result.decisionReason).toContain("mechanism: Ini masih pengamatan");
  });

  it("fails the sentence form in code when it is not Kita … sehingga …", async () => {
    const m = model();
    const result = await runIdeaChecks({ ...base, statement: "Sate dibakar di bara arang.", ask: m.ask });
    expect(statusOf(result, "proposal")).toBe("FAIL");
    expect(result.criteria[0]?.reason).toContain("Kita … sehingga");
    expect(m.asked).toEqual([]);
  });

  it("fails an announced conclusion and a missing Master Thought subject without the model", async () => {
    const announced = await runIdeaChecks({
      ...base,
      statement: "Kita ajak dua orang mencicipi sate sehingga ini menunjukkan bahwa bara lebih penting.",
      skip: ["proposal", "mechanism"],
      ask: model().ask,
    });
    expect(statusOf(announced, "result")).toBe("FAIL");
    const noSubject = await runIdeaChecks({ ...base, masterSubject: "", skip: ["proposal", "mechanism", "result", "stakeHolds"], ask: model().ask });
    expect(statusOf(noSubject, "causeLock")).toBe("FAIL");
  });

  it("passes a switched-off check without asking, and asks nothing when every check is off", async () => {
    const m = model();
    const result = await runIdeaChecks({ ...base, skip: [...IDEA_CHECK_IDS], ask: m.ask });
    expect(result.decision).toBe("LOLOS");
    expect(m.asked).toEqual([]);
    expect(result.criteria.every((row) => row.reason === "Dimatikan untuk organisasi ini.")).toBe(true);
  });

  it("does not count a distinct failure that names no other passed Idea", async () => {
    const peers = [{ code: "ID01", statement: "Kita bandingkan dua bumbu sehingga beda rasanya terasa.", mechanism: "" }];
    const vague = await runIdeaChecks({ ...base, peers, ask: model({ distinct: "Mirip dengan ide lain." }).ask });
    expect(statusOf(vague, "distinct")).toBe("PASS");
    const named = await runIdeaChecks({ ...base, peers, ask: model({ distinct: "Sama dengan ID01: prinsipnya sama." }).ask });
    expect(statusOf(named, "distinct")).toBe("FAIL");
  });

  it("keeps the comparison open when the stored Ideas could not be loaded", async () => {
    const result = await runIdeaChecks({ ...base, historyAvailable: false, ask: model().ask });
    expect(statusOf(result, "distinct")).toBe("BELUM_TERVERIFIKASI");
    expect(result.decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("marks a check undecided after two unreadable answers", async () => {
    const result = await runIdeaChecks({ ...base, skip: ["mechanism", "result", "stakeHolds", "causeLock", "watchable", "distinct"], ask: async () => "nope" });
    expect(statusOf(result, "proposal")).toBe("BELUM_TERVERIFIKASI");
  });

  it("fails a sentence that already failed with the same check, without asking", async () => {
    const m = model();
    const result = await runIdeaChecks({
      ...base,
      failures: [{ code: "ID02", statement: base.statement, angleId: "a", sameAngle: true, failed: [{ id: "result", reason: "Hasilnya tidak mengikuti." }], unverified: [] }],
      ask: m.ask,
    });
    expect(statusOf(result, "result")).toBe("FAIL");
    expect(result.criteria.find((row) => row.id === "result")?.reason).toBe("Hasilnya tidak mengikuti.");
  });

  it("asks one check with its own rule, the keys, and the chain", () => {
    const prompt = buildIdeaCheckPrompt("causeLock", { ...base, ask: async () => null });
    expect(prompt).toContain("satu-satunya penyebab yang masuk akal");
    expect(prompt).toContain("Subjek Master Thought: cara sate dibakar");
    expect(prompt).toContain("- Dagingnya beda / Dipotong dari bagian yang sama");
    expect(prompt).toContain("Master Thought: Rasa sate lebih ditentukan cara dibakar daripada bumbunya.");
    expect(buildIdeaCheckPrompt("mechanism", { ...base, ask: async () => null })).toContain("Situasi boleh berlanjut");
  });
});
