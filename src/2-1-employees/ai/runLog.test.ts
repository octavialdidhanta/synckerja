import { describe, expect, it } from "vitest";
import { chainOptions, parsePillars, pillarOptions, rowFitsPillar, selectInTree, parseThinkingTree, treeOptions, ideaCode, jakartaMonth, parseRunLog, rowFitsChain, runReason, setChainLevel, shiftMonth, summarizeRows } from "./runLog";

const t = (_key: string, fallback: string) => fallback;

describe("parseRunLog", () => {
  it("reads rows, plans, chain and Canva result", () => {
    const log = parseRunLog({
      month: "2026-11",
      summary: { runs: 3, succeeded: 2, failed: 1, deferred: 0, running: 0, plans: 2, unique_ideas: 1 },
      rows: [{
        id: "r1",
        sop_code: "SOP1",
        status: "succeeded",
        trigger_source: "manual",
        started_at: "2026-11-13T04:11:19Z",
        note: "sop1 done steps=8 open=1 plans=1 calls=14",
        plan_count: 1,
        attempt: null,
        plans: [{
          id: "p1",
          title: "Daging muda vs tua",
          pillar_name: "Did You Know?",
          idea_month_count: 4,
          chain: {
            idea: { id: "i1", code: "ID01", statement: "Panduan visual" },
            angle: { code: "AN02", statement: "Diskusi kuliner" },
            territory: { code: "TR03", statement: "diskusi kuliner" },
            big_thought: { code: "BT01", statement: "Kambing muda" },
            master: { statement: "Garansi empuk" },
          },
          canva: { status: "succeeded", images_ready: true, logo_placed: true, error: "", design_url: "javascript:alert(1)" },
        }],
      }, { id: "" }],
    });
    expect(log.summary.uniqueIdeas).toBe(1);
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].source).toBe("manual");
    expect(log.rows[0].plans[0].ideaMonthCount).toBe(4);
    expect(ideaCode(log.rows[0].plans[0].chain)).toBe("AN02 · ID01");
    expect(log.rows[0].plans[0].chain?.bigThought?.code).toBe("BT01");
    expect(log.rows[0].plans[0].canva?.designUrl).toBe("");
  });

  it("keeps an unknown source empty", () => {
    expect(parseRunLog({ rows: [{ id: "r", trigger_source: "other" }] }).rows[0].source).toBeNull();
  });
});

describe("runReason", () => {
  it("names the failed check", () => {
    expect(runReason({ note: "sop1 checks_failed steps=8 reject=hookHolds", status: "failed", planCount: 0 }, t))
      .toBe("Semua draf gagal dicek: hook slide 1");
    expect(runReason({ note: "sop1 time_budget steps=8 reject=copy:title@Garansi", status: "deferred", planCount: 0 }, t))
      .toBe("Waktu habis sebelum draf lolos (naskah terlalu mirip plan sebelumnya)");
  });

  it("explains a path that did not fit the pillar", () => {
    expect(runReason({ note: "sop1 path_unconfirmed steps=8 open=1", status: "failed", planCount: 0 }, t))
      .toBe("Ide di Fokus angle belum cocok dengan pilar yang dipilih");
  });

  it("falls back to the status", () => {
    expect(runReason({ note: "manual", status: "running", planCount: 0 }, t)).toBe("Sedang berjalan");
    expect(runReason({ note: "", status: "succeeded", planCount: 1 }, t)).toBe("Plan dibuat");
  });
});

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("uses the Jakarta month", () => {
    expect(jakartaMonth(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11");
  });
});

describe("chain filters", () => {
  const chain = (master: string, angle: string, idea: string) => ({
    idea: { id: idea, code: idea.toUpperCase(), statement: `Idea ${idea}` },
    angle: { id: angle, code: angle.toUpperCase(), statement: `Angle ${angle}` },
    territory: { id: "t1", code: "TR01", statement: "Territory" },
    big_thought: { id: "b1", code: "BT01", statement: "Big" },
    master: { id: master, statement: `Master ${master}` },
  });
  const log = parseRunLog({
    rows: [
      { id: "r1", status: "succeeded", plans: [{ id: "p1", chain: chain("m1", "a1", "i1") }] },
      { id: "r2", status: "failed", plans: [], attempt: { chain: chain("m1", "a2", "i2"), pillar_name: "P" } },
      { id: "r3", status: "succeeded", plans: [{ id: "p3", chain: chain("m2", "a3", "i3") }] },
      { id: "r4", status: "deferred", plans: [] },
    ],
  });

  it("lists children of the chosen parent only", () => {
    expect(chainOptions(log.rows, {}, "master").map((option) => option.id).join(",")).toBe("m1,m2");
    expect(chainOptions(log.rows, { master: "m1" }, "angle").map((option) => option.id).join(",")).toBe("a1,a2");
    expect(chainOptions(log.rows, { master: "m1" }, "angle")[0].label).toBe("A1 · Angle a1");
  });

  it("filters runs, including the idea a failed run tried", () => {
    const filter = { master: "m1" };
    expect(log.rows.filter((row) => rowFitsChain(row, filter)).map((row) => row.id).join(",")).toBe("r1,r2");
    expect(log.rows.filter((row) => rowFitsChain(row, {})).length).toBe(4);
  });

  it("clears the levels below a changed parent", () => {
    expect(setChainLevel({ master: "m1", angle: "a1", idea: "i1" }, "master", "m2")).toEqual({ master: "m2" });
    expect(setChainLevel({ master: "m1", angle: "a1" }, "angle", "")).toEqual({ master: "m1" });
  });

  it("recounts the summary for the shown runs", () => {
    const summary = summarizeRows(log.rows.filter((row) => rowFitsChain(row, { master: "m1" })));
    expect(summary.runs).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.plans).toBe(1);
    expect(summary.uniqueIdeas).toBe(1);
  });
});

describe("thinking tree options", () => {
  const tree = parseThinkingTree([
    { level: "master", id: "m1", label: "Garansi empuk", ready: true },
    { level: "master", id: "m2", label: "Bebas prengus", ready: true },
    { level: "bigThought", id: "b1", parent_id: "m1", code: "BT01", label: "Pemilihan Daging", ready: true },
    { level: "bigThought", id: "b2", parent_id: "m1", code: "BT02", label: "Proses Memasak", ready: true },
    { level: "bigThought", id: "b3", parent_id: "m2", code: "BT01", label: "Daging Pilihan", ready: true },
    { level: "territory", id: "t1", parent_id: "b1", code: "TR01", label: "diskusi kuliner", ready: true },
    { level: "angle", id: "a1", parent_id: "t1", code: "AN01", label: "Angle satu", ready: true, in_focus: true },
    { level: "idea", id: "i1", parent_id: "a1", code: "ID01", label: "Idea satu", ready: true },
    { level: "idea", id: "i2", parent_id: "a1", code: "ID02", label: "Idea dua", ready: false },
    { level: "other", id: "x" },
  ]);
  const log = parseRunLog({
    rows: [{ id: "r1", status: "succeeded", plans: [{ id: "p1", chain: {
      idea: { id: "i1", code: "ID01", statement: "Idea satu" },
      angle: { id: "a1", code: "AN01", statement: "Angle satu" },
      territory: { id: "t1", code: "TR01", statement: "diskusi kuliner" },
      big_thought: { id: "b1", code: "BT01", statement: "x" },
      master: { id: "m1", statement: "Garansi empuk" },
    } }] }],
  });

  it("lists every branch, used or not, with the parent named while it is open", () => {
    const thoughts = treeOptions(tree, log.rows, {}, "bigThought");
    expect(thoughts.length).toBe(3);
    expect(thoughts[0].label).toBe("BT01 · Pemilihan Daging — Garansi empuk");
    expect(thoughts.map((option) => option.runs).join(",")).toBe("1,0,0");
  });

  it("limits children to the chosen parent and drops the hint", () => {
    const thoughts = treeOptions(tree, log.rows, { master: "m1" }, "bigThought");
    expect(thoughts.map((option) => option.id).join(",")).toBe("b1,b2");
    expect(thoughts[1].label).toBe("BT02 · Proses Memasak");
    const ideas = treeOptions(tree, log.rows, { master: "m1", angle: "a1" }, "idea");
    expect(ideas.map((option) => `${option.id}:${option.runs}:${option.ready}`).join(",")).toBe("i1:1:true,i2:0:false");
    expect(treeOptions(tree, log.rows, { master: "m2" }, "idea").length).toBe(0);
    expect(treeOptions(tree, log.rows, {}, "angle")[0].inFocus).toBe(true);
  });
});

describe("idea picks its parents, pillar filter", () => {
  const raw = [
    { level: "master", id: "m1", label: "Garansi empuk" },
    { level: "bigThought", id: "b1", parent_id: "m1", code: "BT01", label: "Pemilihan Daging" },
    { level: "territory", id: "t1", parent_id: "b1", code: "TR01", label: "diskusi kuliner" },
    { level: "angle", id: "a1", parent_id: "t1", code: "AN01", label: "Angle satu" },
    { level: "idea", id: "i1", parent_id: "a1", code: "ID01", label: "Idea satu" },
    { level: "pillar", id: "p1", label: "Myth vs Fact", in_focus: false },
    { level: "pillar", id: "p2", label: "Did You Know?", in_focus: false },
  ];
  const tree = parseThinkingTree(raw);

  it("fills every parent of a chosen idea and clears below a chosen parent", () => {
    expect(selectInTree(tree, {}, "idea", "i1")).toEqual({ master: "m1", bigThought: "b1", territory: "t1", angle: "a1", idea: "i1" });
    expect(selectInTree(tree, { master: "m1", bigThought: "b1", territory: "t1", angle: "a1", idea: "i1" }, "territory", "t1"))
      .toEqual({ master: "m1", bigThought: "b1", territory: "t1" });
    expect(selectInTree(tree, { master: "m1", angle: "a1" }, "angle", "")).toEqual({ master: "m1" });
  });

  it("counts runs per pillar, tried pillars included, used first", () => {
    const log = parseRunLog({
      rows: [
        { id: "r1", status: "succeeded", plans: [{ id: "x", pillar_id: "p2", pillar_name: "Did You Know?" }] },
        { id: "r2", status: "failed", plans: [], attempt: { pillar_id: "p9", pillar_name: "1-Minute Case Study" } },
      ],
    });
    const options = pillarOptions(parsePillars(raw), log.rows);
    expect(options.map((option) => `${option.label}:${option.runs}`).join(",")).toBe("1-Minute Case Study:1,Did You Know?:1,Myth vs Fact:0");
    expect(rowFitsPillar(log.rows[1], "p9")).toBe(true);
    expect(rowFitsPillar(log.rows[0], "p9")).toBe(false);
    expect(rowFitsPillar(log.rows[0], "")).toBe(true);
  });
});
