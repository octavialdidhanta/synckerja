import { describe, expect, it } from "vitest";
import {
  holdPassingTerritoryVerdicts,
  mergeTerritoryAuditLessons,
  normalizeTerritorySet,
  readTerritorySetRecord,
  scoreTerritoryAudit,
  territoryFailureLessons,
} from "@/thinking-lab/territory/setAudit";

const fingerprint = "set-fp";

describe("territory sibling audit", () => {
  it("fails the overlapping pair and passes a distinct sibling", () => {
    const set = normalizeTerritorySet(
      {
        coreDistinct: false,
        materialOverlapPairs: [{ territoryCodeA: "TR01", territoryCodeB: "TR03", explanation: "Same space" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    const items = scoreTerritoryAudit({ codes: ["TR01", "TR03", "TR04"], siblingSet: set, siblingSetCurrent: true });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_FAIL", "AUDIT_FAIL", "AUDIT_PASS"]);
  });

  it("reads overlap and containment when the model uses alternate keys", () => {
    const set = normalizeTerritorySet(
      {
        coreDistinct: false,
        materialOverlapPairs: [
          { territory1: "TR01", territory2: "TR04", explanation: "Shared external effect" },
        ],
        containmentPairs: [
          { broaderTerritory: "TR01", containedTerritory: "TR03", explanation: "TR03 sits inside TR01" },
        ],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    expect(set.resolution).toBe("RESOLVED");
    const items = scoreTerritoryAudit({ codes: ["TR01", "TR03", "TR04"], siblingSet: set, siblingSetCurrent: true });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_FAIL"]);
  });

  it("fails only the broad container when it swallows an otherwise distinct set", () => {
    const set = normalizeTerritorySet(
      {
        coreDistinct: false,
        materialOverlapPairs: [],
        containmentPairs: [
          { containerCode: "TR05", containedCode: "TR01", explanation: "TR05 covers TR01" },
          { containerCode: "TR05", containedCode: "TR03", explanation: "TR05 covers TR03" },
          { containerCode: "TR05", containedCode: "TR04", explanation: "TR05 covers TR04" },
        ],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    const items = scoreTerritoryAudit({
      codes: ["TR01", "TR03", "TR04", "TR05"],
      siblingSet: set,
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_FAIL"]);
  });

  it("does not treat a distinct set with a pair as resolved", () => {
    const set = normalizeTerritorySet(
      {
        coreDistinct: true,
        materialOverlapPairs: [{ territoryCodeA: "TR01", territoryCodeB: "TR03", explanation: "Same space" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    expect(set.resolution).toBe("UNRESOLVED");
    expect(set.coverage).toBe("UNRESOLVED");
  });

  it("keeps a previous pass when a later score fails that code", () => {
    const scored = scoreTerritoryAudit({
      codes: ["TR01", "TR02"],
      siblingSet: normalizeTerritorySet(
        {
          coreDistinct: false,
          materialOverlapPairs: [{ territoryCodeA: "TR01", territoryCodeB: "TR02", explanation: "Same space" }],
          containmentPairs: [],
          resolution: "RESOLVED",
          unresolvedReasons: [],
        },
        fingerprint,
      ),
      siblingSetCurrent: true,
    });
    expect(holdPassingTerritoryVerdicts(scored, ["TR01"]).map((item) => item.verdict)).toEqual([
      "AUDIT_PASS",
      "AUDIT_FAIL",
    ]);
  });

  it("keeps a failed Territory as a lesson for the next generate", () => {
    const set = normalizeTerritorySet(
      {
        coreDistinct: false,
        materialOverlapPairs: [{ territoryCodeA: "TR02", territoryCodeB: "TR04", explanation: "Same functional space" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    const lessons = territoryFailureLessons({
      rows: [
        { code: "TR02", statement: "A passing space" },
        { code: "TR04", statement: "A failed space" },
      ],
      items: [
        { code: "TR02", verdict: "AUDIT_PASS" },
        { code: "TR04", verdict: "AUDIT_FAIL" },
      ],
      siblingSet: set,
    });
    expect(lessons).toEqual([
      { code: "TR04", statement: "A failed space", reason: "TR02 · TR04: Same functional space" },
    ]);
    const stored = readTerritorySetRecord({
      schema: "thinking-lab/territory-set/v1",
      repairCount: 0,
      siblingSet: null,
      audit: null,
      challenger: null,
      auditLessons: mergeTerritoryAuditLessons([], lessons),
    });
    expect(stored.auditLessons).toEqual(lessons);
  });
});
