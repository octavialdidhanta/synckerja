import { describe, expect, it } from "vitest";
import { chainOptions, ideaCode, jakartaMonth, parseRunLog, rowFitsChain, runReason, setChainLevel, shiftMonth, summarizeRows } from "./runLog";

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
