import { describe, expect, it } from "vitest";
import { ideaCode, jakartaMonth, parseRunLog, runReason, shiftMonth } from "./runLog";

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
