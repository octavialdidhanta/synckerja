import { describe, expect, it } from "vitest";
import {
  ANGLE_REVISION_CAP,
  angleVerdict,
  canReviseAngle,
  emptyAngleSetRecord,
  readAngleSetRecord,
  withAngleResult,
  withAngleRevision,
  withoutAngle,
} from "@/thinking-lab/angle/record";
import { evaluateAngleLock, selectAngleStage } from "@/thinking-lab/angle/lock";
import { buildAngleRevisionPrompt, parseAngleRevision } from "@/thinking-lab/angle/revise";

describe("angle set record", () => {
  it("drops the fields of the earlier sibling audit and keeps the items", () => {
    const record = readAngleSetRecord({
      schema: "thinking-lab/angle-set/v1",
      repairCount: 1,
      siblingSet: { fingerprint: "x" },
      audit: { fingerprint: "f", items: [{ code: "AN01", verdict: "AUDIT_PASS", statementFingerprint: "s1" }] },
      auditLessons: [{ code: "AN02", statement: "Lama", reason: "observation: alasan" }],
      revisions: { an01: 2, AN02: "x" },
    });
    expect(record).toEqual({
      schema: "thinking-lab/angle-set/v1",
      audit: { fingerprint: "f", items: [{ code: "AN01", verdict: "AUDIT_PASS", statementFingerprint: "s1" }] },
      auditLessons: [{ code: "AN02", statement: "Lama", reason: "observation: alasan" }],
      revisions: { AN01: 2 },
    });
    expect(readAngleSetRecord(null)).toEqual(emptyAngleSetRecord());
  });

  it("counts a verdict only for the sentence it was saved for", () => {
    const record = withAngleResult(emptyAngleSetRecord(), { code: "AN01", statement: "A", statementFingerprint: "s1", failure: null });
    expect(angleVerdict({ code: "AN01" }, record, "s1")).toBe("AUDIT_PASS");
    expect(angleVerdict({ code: "an01" }, record, "s2")).toBeNull();
    expect(angleVerdict({ code: "AN02" }, record, "s1")).toBeNull();
    expect(angleVerdict({ code: "AN02", status: "locked" }, record, "")).toBe("AUDIT_PASS");
  });

  it("replaces a card's item and turns a fail into a lesson", () => {
    let record = withAngleResult(emptyAngleSetRecord(), { code: "AN01", statement: "A", statementFingerprint: "s1", failure: null });
    record = withAngleResult(record, {
      code: "AN01",
      statement: "B",
      statementFingerprint: "s2",
      failure: { gate: "rightSize", reason: "Terlalu luas." },
    });
    expect(record.audit?.items).toEqual([
      { code: "AN01", verdict: "AUDIT_FAIL", statementFingerprint: "s2", gateFailure: { gate: "rightSize", reason: "Terlalu luas." } },
    ]);
    expect(record.auditLessons).toEqual([{ code: "AN01", statement: "B", reason: "rightSize: Terlalu luas." }]);
    expect(withoutAngle(record, "an01").audit?.items).toEqual([]);
  });

  it("closes Revise after three revisions on one card", () => {
    let record = emptyAngleSetRecord();
    for (let index = 0; index < ANGLE_REVISION_CAP; index += 1) {
      expect(canReviseAngle(record, "AN01")).toBe(true);
      record = withAngleRevision(record, "AN01");
    }
    expect(canReviseAngle(record, "an01")).toBe(false);
    expect(canReviseAngle(record, "AN02")).toBe(true);
    expect(withoutAngle(record, "AN01").revisions).toEqual({});
  });
});

describe("angle stage", () => {
  it("checks unchecked cards first, then locks when every card passed", () => {
    expect(selectAngleStage({ verdicts: [] })).toBeNull();
    expect(selectAngleStage({ verdicts: ["AUDIT_PASS", null] })).toBe("audit");
    expect(selectAngleStage({ verdicts: ["AUDIT_PASS", "AUDIT_FAIL"] })).toBeNull();
    expect(selectAngleStage({ verdicts: ["AUDIT_PASS", "AUDIT_PASS"] })).toBe("lock");
    expect(evaluateAngleLock({ verdicts: ["AUDIT_FAIL"] })).toEqual({ ok: false, reason: "AUDIT_FAIL" });
  });
});

describe("angle revision", () => {
  const card = { statement: "Porsi kecil terasa hemat", subject: "porsi kecil", example: "Pesan dua bungkus." };

  it("names the failed check, the kept checks, and the other Angles", () => {
    const prompt = buildAngleRevisionPrompt({
      territory: "Makan siang kantor",
      card,
      checks: [
        { id: "stakeHolds", state: "pass" },
        { id: "observation", state: "fail", reason: "Ini alasan karena." },
      ],
      peers: [{ code: "AN01", statement: "Antrean panjang dianggap tanda enak" }],
      lessons: [],
      revision: 2,
    });
    expect(prompt).toContain("Failed checks to repair:\nobservation: Ini alasan karena.");
    expect(prompt).toContain("Passed checks that must stay true:\nstakeHolds");
    expect(prompt).toContain("AN01: Antrean panjang dianggap tanda enak");
    expect(prompt).toContain("repair 2 of 3");
  });

  it("keeps the old subject or example when the reply leaves one out", () => {
    expect(parseAngleRevision('{"statement":"Baru"}', card)).toEqual({ statement: "Baru", subject: "porsi kecil", example: "Pesan dua bungkus." });
    expect(parseAngleRevision('{"subject":"x"}', card)).toBeNull();
    expect(parseAngleRevision(null, card)).toBeNull();
  });
});
