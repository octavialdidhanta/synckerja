import { describe, expect, it } from "vitest";
import { buildGeneratePrompt } from "@/thinking-lab/big-thought/generate";
import {
  evaluateSiblingPrecheck,
  failureCodes,
  precheckReplacementCandidate,
  presentFixModelResponse,
  runFixReplacements,
} from "@/thinking-lab/big-thought/fix";
import type { BigThoughtFacts, SemanticExclusion, SiblingSetFacts } from "@/thinking-lab/big-thought/types";

function validFacts(overrides: Partial<BigThoughtFacts> = {}): BigThoughtFacts {
  return {
    code: "NEW",
    whatItSays: "Replacement reason",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

function resolvedSet(overrides: Partial<SiblingSetFacts> = {}): SiblingSetFacts {
  return {
    fingerprint: "set",
    distinct: true,
    duplicatePairs: [],
    reasonContributions: [
      { code: "BT01", reasonContribution: "Kept job" },
      { code: "NEW", reasonContribution: "A different job" },
    ],
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("fix replacements", () => {
  it("returns choices that already passed and does not save them yet", async () => {
    const saved: string[] = [];
    const results = await runFixReplacements({
      failures: [{ code: "BT03", statement: "Weak row", reasonContribution: "Old job", audit: "AUDIT_FAIL" }],
      incumbents: [{ code: "BT01", statement: "Kept", reasonContribution: "Kept job" }],
      exclusions: [],
      propose: async () => null,
      listProposals: async () => ["First safe repair.", "Second safe repair.", "Same as the failure"],
      judge: async (statement) => (statement === "Same as the failure" ? validFacts({ relationToParent: "ELABORATION", explainsWhyParentIsTrue: false }) : validFacts()),
      precheck: async () => ({ accept: true, reasonContribution: "A new job" }),
      onAccepted: async (result) => {
        saved.push(result.statement);
      },
    });
    expect(saved).toEqual([]);
    expect(results.results[0]).toMatchObject({
      code: "BT03",
      result: "OFFERS",
    });
    if (results.results[0]?.result !== "OFFERS") return;
    expect(results.results[0].offers.map((offer) => offer.statement)).toEqual([
      "First safe repair.",
      "Second safe repair.",
    ]);
  });

  it("leaves GENERATE_VALID rows that are not AUDIT_FAIL", () => {
    expect(
      failureCodes([
        { code: "BT01", audit: "AUDIT_FAIL" },
        { code: "BT02", audit: "AUDIT_PASS" },
        { code: "BT03", audit: "AUDIT_FAIL" },
      ]),
    ).toEqual(["BT01", "BT03"]);
  });

  it("does not replace an AUDIT_PASS row even when it is passed in the failure list", async () => {
    const proposed: string[] = [];
    const results = await runFixReplacements({
      failures: [
        { code: "BT01", statement: "Fail one", reasonContribution: "job one", audit: "AUDIT_FAIL" },
        { code: "BT02", statement: "Pass two", reasonContribution: "job two", audit: "AUDIT_PASS" },
        { code: "BT03", statement: "Fail three", reasonContribution: "job three", audit: "AUDIT_FAIL" },
      ],
      incumbents: [{ code: "BT02", statement: "Pass two", reasonContribution: "job two" }],
      exclusions: [],
      propose: async ({ failure }) => {
        proposed.push(failure.code);
        return `Replacement ${failure.code}`;
      },
      judge: async () => validFacts(),
      precheck: async () => ({ accept: true, reasonContribution: "A new job" }),
    });
    expect(proposed).toEqual(["BT01", "BT03"]);
    expect(results.results.map((row) => row.code)).toEqual(["BT01", "BT03"]);
    expect(results.results.every((row) => row.result === "REPLACED")).toBe(true);
  });

  it("saves an accepted candidate before the next failing row is repaired", async () => {
    const saved: string[] = [];
    await runFixReplacements({
      failures: [
        { code: "BT01", statement: "Fail one", reasonContribution: "job one", audit: "AUDIT_FAIL" },
        { code: "BT03", statement: "Fail three", reasonContribution: "job three", audit: "AUDIT_FAIL" },
      ],
      incumbents: [{ code: "BT02", statement: "Pass two", reasonContribution: "job two" }],
      exclusions: [],
      propose: async ({ failure }) => `Replacement ${failure.code}`,
      judge: async () => validFacts(),
      precheck: async () => ({ accept: true, reasonContribution: "A new job" }),
      onAccepted: async (result) => {
        saved.push(result.code);
      },
    });
    expect(saved).toEqual(["BT01", "BT03"]);
  });

  it("passes occupied contributions, the failed contribution, and overlap explanations as free text", () => {
    const prompt = buildGeneratePrompt({
      parentStatement: "A general belief",
      incumbents: [
        {
          code: "BT01",
          statement: "Kept statement",
          reasonContribution: "Impact depends on management.",
        },
      ],
      needed: 1,
      missingWhy: null,
      exclusions: [
        {
          reasonContribution: "Continuing responsibility.",
          explanation: "Both describe the giver's ongoing duty.",
          codes: ["BT02", "BT03"],
        },
      ],
      failed: {
        code: "BT03",
        statement: "Failed statement",
        reasonContribution: "Continuing responsibility.",
      },
    });
    expect(prompt).toContain("Reason contribution: Impact depends on management.");
    expect(prompt).toContain("Reason contribution: Continuing responsibility.");
    expect(prompt).toContain("Overlap explanation: Both describe the giver's ongoing duty.");
    expect(prompt).toContain("Different wording is not sufficient.");
    expect(prompt).not.toMatch(/\b(blacklist|synonym|keyword|OCCUPIED_SPACE)\b/i);
  });

  it("returns a replacement only when the candidate survives the sibling precheck", async () => {
    const results = await runFixReplacements({
      failures: [{ code: "BT03", statement: "Weak row", reasonContribution: "Old job", audit: "AUDIT_FAIL" }],
      incumbents: [{ code: "BT01", statement: "Kept", reasonContribution: "Kept job" }],
      exclusions: [],
      propose: async () => "A stronger foundational reason",
      judge: async () => validFacts(),
      precheck: async () => ({ accept: true, reasonContribution: "A different job" }),
    });
    expect(results.results[0]?.result).toBe("REPLACED");
    if (results.results[0]?.result === "REPLACED") {
      expect(results.results[0].code).toBe("BT03");
      expect(results.results[0].reasonContribution).toBe("A different job");
    }
  });

  it("does not accept an individually valid candidate that the sibling judge places in a duplicate pair", async () => {
    let prechecks = 0;
    const results = await runFixReplacements({
      failures: [{ code: "BT03", statement: "Weak row", reasonContribution: "Old job", audit: "AUDIT_FAIL" }],
      incumbents: [{ code: "BT01", statement: "Kept", reasonContribution: "Kept job" }],
      exclusions: [],
      propose: async () => "A reworded incumbent",
      judge: async () => validFacts(),
      precheck: async () => {
        prechecks += 1;
        return {
          accept: false,
          discovered: [
            {
              reasonContribution: "Kept job",
              explanation: "Same reasoning job despite different wording.",
              codes: ["BT01", "NEW"],
            },
          ],
        };
      },
    });
    expect(prechecks).toBe(2);
    expect(results.results[0]).toMatchObject({ code: "BT03", result: "NO_SAFE_REPLACEMENT" });
    expect(results.results[0]?.attempts).toHaveLength(2);
    expect(results.results[0]?.attempts.every((attempt) => attempt.precheck === "rejected")).toBe(true);
  });

  it("feeds the sibling overlap explanation into the next attempt and stops at two", async () => {
    const seen: SemanticExclusion[][] = [];
    const results = await runFixReplacements({
      failures: [{ code: "BT03", statement: "Weak row", reasonContribution: "Old job", audit: "AUDIT_FAIL" }],
      incumbents: [{ code: "BT01", statement: "Kept", reasonContribution: "Kept job" }],
      exclusions: [{ reasonContribution: "Kept job", explanation: "", codes: ["BT01"] }],
      propose: async ({ exclusions, attempt }) => {
        expect(attempt).toBeLessThanOrEqual(2);
        seen.push(exclusions.map((entry) => ({ ...entry, codes: [...entry.codes] })));
        return `Candidate ${attempt}`;
      },
      judge: async () => validFacts(),
      precheck: async () => ({
        accept: false,
        discovered: [
          {
            reasonContribution: "Kept job again",
            explanation: "Overlaps the incumbent job.",
            codes: ["BT01", "NEW"],
          },
        ],
      }),
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]?.some((entry) => entry.explanation === "Overlaps the incumbent job.")).toBe(false);
    expect(seen[1]?.some((entry) => entry.explanation === "Overlaps the incumbent job.")).toBe(true);
    expect(results.results[0]).toMatchObject({ code: "BT03", result: "NO_SAFE_REPLACEMENT" });
    expect(results.results[0]?.attempts).toHaveLength(2);
  });

  it("returns NO_SAFE_REPLACEMENT when no candidate is GENERATE_VALID", async () => {
    let prechecks = 0;
    const results = await runFixReplacements({
      failures: [{ code: "BT03", statement: "Weak row", reasonContribution: null, audit: "AUDIT_FAIL" }],
      incumbents: [],
      exclusions: [],
      propose: async () => "Still not a why",
      judge: async () => validFacts({ resolution: "UNRESOLVED", unresolvedReasons: ["INCOMPLETE"] }),
      precheck: async () => {
        prechecks += 1;
        return { accept: true, reasonContribution: "unused" };
      },
    });
    expect(prechecks).toBe(0);
    expect(results.results[0]).toMatchObject({ code: "BT03", result: "NO_SAFE_REPLACEMENT" });
    expect(results.results[0]?.attempts[0]?.admission).not.toBe("GENERATE_VALID");
  });

  it("shows an earlier accepted replacement to the next failed row", async () => {
    const seen: string[][] = [];
    await runFixReplacements({
      failures: [
        { code: "BT02", statement: "Fail two", reasonContribution: "job two", audit: "AUDIT_FAIL" },
        { code: "BT03", statement: "Fail three", reasonContribution: "job three", audit: "AUDIT_FAIL" },
      ],
      incumbents: [{ code: "BT01", statement: "Keep", reasonContribution: "job one" }],
      exclusions: [],
      propose: async ({ failure, incumbents }) => {
        seen.push(incumbents.map((row) => row.code));
        return `Replacement for ${failure.code}`;
      },
      judge: async () => validFacts(),
      precheck: async () => ({ accept: true, reasonContribution: "A new job" }),
    });
    expect(seen[0]).toEqual(["BT01"]);
    expect(seen[1]).toEqual(["BT01", "P1"]);
  });

  it("keeps an unreplaced failure visible to the next replacement", async () => {
    const seen: Array<{ failure: string; incumbents: string[] }> = [];
    await runFixReplacements({
      failures: [
        { code: "BT02", statement: "Fail two", reasonContribution: "job two", audit: "AUDIT_FAIL" },
        { code: "BT03", statement: "Fail three", reasonContribution: "job three", audit: "AUDIT_FAIL" },
      ],
      incumbents: [{ code: "BT01", statement: "Keep", reasonContribution: "job one" }],
      exclusions: [],
      propose: async ({ failure, incumbents }) => {
        seen.push({ failure: failure.code, incumbents: incumbents.map((row) => row.code) });
        return `Candidate ${failure.code}`;
      },
      judge: async (statement) =>
        statement.endsWith("BT02")
          ? validFacts({ resolution: "UNRESOLVED", unresolvedReasons: ["INCOMPLETE"] })
          : validFacts(),
      precheck: async () => ({ accept: true, reasonContribution: "A new job" }),
    });
    const next = seen.find((call) => call.failure === "BT03");
    expect(next?.incumbents).toContain("BT02");
    expect(next?.incumbents).not.toContain("P1");
  });

  it("uses the existing sibling judge and does not decide overlap from wording", async () => {
    const prompts: string[] = [];
    const decision = await precheckReplacementCandidate(
      {
        parentStatement: "A general belief",
        candidateStatement: "A reworded incumbent",
        incumbents: [{ code: "BT01", statement: "Kept reason" }],
        fingerprint: "parent",
      },
      async (prompt) => {
        prompts.push(prompt);
        return JSON.stringify({
          distinct: false,
          duplicatePairs: [
            { a: "BT01", b: "NEW", explanation: "Same reasoning job despite different wording." },
          ],
          reasonContributions: [
            { code: "BT01", reasonContribution: "Kept job" },
            { code: "NEW", reasonContribution: "Same kept job" },
          ],
          resolution: "RESOLVED",
          unresolvedReasons: [],
        });
      },
    );
    expect(prompts[0]).toContain("canonical semantic judge for sibling distinctness");
    expect(decision.accept).toBe(false);
    const accepted = evaluateSiblingPrecheck({
      candidateCode: "NEW",
      activeCodes: ["BT01", "NEW"],
      siblingSet: resolvedSet(),
    });
    expect(accepted).toEqual({ accept: true, reasonContribution: "A different job" });
    const collided = evaluateSiblingPrecheck({
      candidateCode: "NEW",
      activeCodes: ["BT01", "NEW"],
      siblingSet: resolvedSet({
        distinct: false,
        duplicatePairs: [{ a: "BT01", b: "NEW", explanation: "Same reasoning job." }],
        reasonContributions: [
          { code: "BT01", reasonContribution: "Kept job" },
          { code: "NEW", reasonContribution: "Same kept job" },
        ],
      }),
    });
    expect(collided.accept).toBe(false);
  });

  it("keeps valid and invalid Fix responses visible", () => {
    const proposal = presentFixModelResponse(
      "proposal",
      JSON.stringify({ statements: ["A distinct reason the parent is true."] }),
    );
    expect(proposal.valid).toBe(true);
    expect(proposal.body).toContain("A distinct reason the parent is true.");

    const restatement = presentFixModelResponse(
      "individual",
      JSON.stringify({
        code: "NEW",
        whatItSays: "The same conclusion in other words.",
        relationToParent: "RESTATEMENT",
        supportRole: "UNRESOLVED",
        explainsWhyParentIsTrue: "unresolved",
        introducesUnsupportedPremise: "unresolved",
        duplicateOfCode: null,
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
    );
    expect(restatement.valid).toBe(false);
    expect(restatement.body).toContain("RESTATEMENT");

    const confirmed = presentFixModelResponse(
      "adversarial",
      JSON.stringify({
        verdict: "CONFIRM_MATERIAL_SUPPORT",
        reason: "Material support: this premise is absent from the parent.",
      }),
    );
    expect(confirmed.valid).toBe(true);
    expect(confirmed.body).toContain("Material support:");

    const elaboration = presentFixModelResponse(
      "adversarial",
      JSON.stringify({
        verdict: "REJECT_AS_ELABORATION",
        reason: "The closing clause restates the parent conclusion.",
      }),
    );
    expect(elaboration.valid).toBe(false);
    expect(elaboration.body).toContain("REJECT_AS_ELABORATION");
    expect(elaboration.body).toContain("The closing clause restates the parent conclusion.");

    const broken = '{ "distinct": true, "reasonContributions": [ { "code": "NEW", "reasonContribution": "A job", } ] }';
    const sibling = presentFixModelResponse("sibling", broken, ["BT01", "NEW"]);
    expect(sibling.valid).toBe(false);
    expect(sibling.body).toBe(broken.trim());
  });
});
