import { describe, expect, it } from "vitest";
import {
  checksFromValidation,
  ideaHistorySummary,
  readIdeaValidation,
  uncheckedIdeaValidation,
  withAuditHistory,
} from "@/thinking-lab/idea/check/record";
import { failureItemsFromIdeas, peersFromIdeas } from "@/thinking-lab/idea/check/memory";

const legacy = (decision: string, criteria: Array<{ id: string; status: string; explanation?: string; reason?: string }>) => ({
  schema: "thinking-lab/idea-validation/v1",
  generatorVersion: "idea-k1k7/v1",
  decision,
  criteria,
  statement: "Kita bandingkan dua piring sehingga bedanya terlihat.",
  mechanism: "Dua piring berdampingan",
  validatedAt: "2026-11-01T00:00:00.000Z",
  auditHistory: [],
});

describe("stored Idea results", () => {
  it("reads a passed K1-K7 result as passed on all seven checks", () => {
    const read = readIdeaValidation(legacy("LOLOS", [{ id: "K1", status: "PASS", explanation: "Usulan spesifik." }]));
    expect(read?.decision).toBe("LOLOS");
    expect(read?.criteria.every((row) => row.status === "PASS")).toBe(true);
    expect(read?.criteria.find((row) => row.id === "proposal")?.reason).toBe("Usulan spesifik.");
    expect(read?.criteria.find((row) => row.id === "mechanism")?.reason).toBe("Lolos dengan aturan lama (K1–K7).");
  });

  it("maps a failed K check to the check that replaced it and reads the old reason format", () => {
    const read = readIdeaValidation(
      legacy("DITOLAK", [
        { id: "K3", status: "PASS", explanation: "Nilainya mengikuti." },
        { id: "K4", status: "FAIL", reason: "STATUS: FAIL\nBUKTI: x\nPENJELASAN: Nilainya umum.\nKELEMAHAN: y" },
        { id: "K2", status: "PASS" },
      ]),
    );
    expect(read?.decision).toBe("DITOLAK");
    expect(read?.criteria.find((row) => row.id === "result")).toEqual({ id: "result", status: "FAIL", reason: "Nilainya umum." });
  });

  it("reads nothing from a row without a known result", () => {
    expect(readIdeaValidation(null)).toBe(null);
    expect(readIdeaValidation({ schema: "thinking-lab/idea-validation/v1", generatorVersion: "other", criteria: [] })).toBe(null);
  });

  it("checks only the sentence form of an Idea saved before any check ran", () => {
    const angle = "Orang menyalahkan bumbu, padahal masalahnya di api.";
    expect(uncheckedIdeaValidation("Sate dibakar di bara.", angle).decision).toBe("DITOLAK");
    expect(uncheckedIdeaValidation("Kita bakar dua sate sehingga bedanya terasa.", angle).decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("keeps the previous result in the history, newest first", () => {
    const first = readIdeaValidation(legacy("DITOLAK", [{ id: "K1", status: "FAIL", explanation: "Bukan usulan." }]))!;
    const next = withAuditHistory(first, { ...first, decision: "LOLOS", validatedAt: "2026-11-02T00:00:00.000Z", auditHistory: [] });
    expect(next.auditHistory).toHaveLength(1);
    expect(next.auditHistory[0]?.decision).toBe("DITOLAK");
  });

  it("summarizes the history by its most failed check, and shows a reason only off a pass", () => {
    const failed = readIdeaValidation(legacy("DITOLAK", [{ id: "K5", status: "FAIL", explanation: "Sama dengan ID01." }]))!;
    expect(ideaHistorySummary([failed, failed])).toEqual({ passed: 0, rejected: 2, unverified: 0, topFailed: "distinct" });
    expect(checksFromValidation(failed).find((row) => row.id === "distinct")).toEqual({ id: "distinct", state: "fail", reason: "Sama dengan ID01." });
  });

  it("remembers failed sentences and compares only with passed Ideas", () => {
    const failed = readIdeaValidation(legacy("DITOLAK", [{ id: "K7", status: "FAIL", explanation: "Butuh alat baru." }]))!;
    const passed = readIdeaValidation(legacy("LOLOS", []))!;
    const rows = [
      { code: "ID01", statement: "Kita A sehingga B.", angleId: "a", validation: failed },
      { code: "ID02", statement: "Kita C sehingga D.", angleId: "b", validation: passed },
    ];
    expect(failureItemsFromIdeas(rows, "a")[0]?.failed).toEqual([{ id: "watchable", reason: "Butuh alat baru." }]);
    expect(peersFromIdeas(rows)).toEqual([{ code: "ID02", statement: "Kita C sehingga D.", mechanism: "Dua piring berdampingan" }]);
  });
});
