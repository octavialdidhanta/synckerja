import { describe, expect, it, vi } from "vitest";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { normalizeBigThoughtFacts } from "@/thinking-lab/big-thought/semantic";
import {
  buildBigThoughtPassPrompt,
  factsForGenerateAdmission,
  fixPriorForNextSentence,
  generateDuplicateFailure,
  lessonsForPassGate,
  runBigThoughtIndividualChecks,
  runBigThoughtOpenChecks,
  runGenerateAdmissionChecks,
} from "@/thinking-lab/big-thought/passChecks";

describe("Big Thought pass checks", () => {
  it("treats ordinary new material as allowed on the premise gate", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "premise",
      statement: "Daging pilihan diolah khusus agar bebas bau prengus.",
      parentStatement: "Sate kambing berkualitas tinggi dapat dinikmati tanpa bau prengus.",
      others: [],
    });
    expect(prompt).toContain("New material information that the Master Thought does not already state is allowed");
    expect(prompt).toContain("Do not fail merely because the parent does not contain or prove this sentence");
    expect(prompt).toContain("unjustifiably specific empirical assertion");
    expect(prompt).not.toContain("does not depend on a specific fact that would need separate evidence");
  });

  it("sends earlier premise failures into the premise pass prompt", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "premise",
      statement: "A repaired clause",
      parentStatement: "The master claim",
      others: [],
      lessons: [
        {
          statement: "Every batch is 100% free of smell within one day.",
          reason: "premise: Klaim universal yang membutuhkan bukti terpisah.",
        },
        {
          statement: "A different relation failure",
          reason: "relation: It restates the Master Thought.",
        },
      ],
    });
    expect(prompt).toContain("Earlier premise failures for this Big Thought");
    expect(prompt).toContain("Every batch is 100% free of smell within one day.");
    expect(prompt).toContain("Klaim universal yang membutuhkan bukti terpisah.");
    expect(prompt).not.toContain("It restates the Master Thought.");
  });

  it("keeps only matching gate lessons", () => {
    expect(
      lessonsForPassGate(
        [
          { statement: "A", reason: "premise: too specific" },
          { statement: "B", reason: "relation: restates" },
          { statement: "C", reason: "No replacement came back." },
        ],
        "premise",
      ),
    ).toEqual([{ statement: "A", reason: "too specific" }]);
  });

  it("treats one result of the same cause as part of the reason", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "relation",
      statement: "Pengelola yang berbeda mengubah dampak, sehingga dana yang sama tidak menghasilkan hal yang sama.",
      parentStatement: "Memilih pengelola adalah bagian dari tanggung jawab.",
      others: [],
    });
    expect(prompt).toContain("joined with sehingga or so that, stays part of the reason");
    expect(prompt).toContain("A bare outcome only follows after the Master Thought.");
    expect(prompt).toContain("The result also fails when it repeats the Master Thought or opens a second reason.");
    expect(prompt).not.toContain("names an outcome");
  });

  it("rejects a finished sentence that does not already follow because", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "relation",
      statement: "Pemilihan pengelola yang berbeda mengubah hasil pengelolaan.",
      parentStatement: "Memilih pengelola adalah bagian dari tanggung jawab.",
      others: [],
    });
    expect(prompt).toContain(
      "inserting only the word because between the Master Thought and this sentence already makes one grammatical sentence",
    );
    expect(prompt).toContain("without opening a separate claim");
    expect(prompt).toContain("would need to be rewritten before it can follow because");
    expect(prompt).toContain("only names an area");
    expect(prompt).toContain("rarely noticed observation rather than a reason");
  });

  it("stops at the first failed check and does not ask the later ones", async () => {
    const ask = vi.fn(async () => "{\"pass\":false,\"reason\":\"It restates the Master Thought.\"}");
    const result = await runBigThoughtIndividualChecks({
      statement: "The same claim again",
      parentStatement: "The master claim",
      others: [],
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.failure?.gate).toBe("resolved");
    expect(result.items.find((item) => item.id === "relation")?.state).toBe("pending");
  });

  it("keeps a passed check and asks only the failed one again", async () => {
    const ask = vi.fn(async () => "{\"pass\":true,\"reason\":\"\"}");
    const result = await runBigThoughtOpenChecks({
      statement: "A repaired clause",
      parentStatement: "The master claim",
      others: [{ code: "BT01", statement: "A different reason" }],
      prior: [
        { id: "resolved", state: "pass", reason: "" },
        { id: "relation", state: "fail", reason: "It restates the Master Thought." },
        { id: "role", state: "pending", reason: "" },
        { id: "explains", state: "pending", reason: "" },
        { id: "premise", state: "pending", reason: "" },
        { id: "duplicate", state: "pending", reason: "" },
        { id: "sibling", state: "pending", reason: "" },
      ],
      ask,
    });
    expect(result.passed).toBe(true);
    expect(ask.mock.calls.length).toBe(5);
    expect(result.items.find((item) => item.id === "resolved")?.state).toBe("pass");
  });

  it("feeds premise lessons into the open premise re-check", async () => {
    const ask = vi.fn(async () => "{\"pass\":true,\"reason\":\"\"}");
    await runBigThoughtOpenChecks({
      statement: "An ordinary process reason",
      parentStatement: "The master claim",
      others: [],
      prior: [
        { id: "resolved", state: "pass", reason: "" },
        { id: "relation", state: "pass", reason: "" },
        { id: "role", state: "pass", reason: "" },
        { id: "explains", state: "pass", reason: "" },
        { id: "premise", state: "fail", reason: "too specific" },
        { id: "duplicate", state: "pending", reason: "" },
        { id: "sibling", state: "pending", reason: "" },
      ],
      lessons: [
        {
          statement: "Every batch is always 100% free of smell.",
          reason: "premise: Klaim universal yang membutuhkan bukti terpisah.",
        },
      ],
      ask,
    });
    expect(String(ask.mock.calls[0]?.[0])).toContain("Earlier premise failures for this Big Thought");
    expect(String(ask.mock.calls[0]?.[0])).toContain("Every batch is always 100% free of smell.");
  });

  it("keeps the two generate passes and audits the remaining checks", async () => {
    const steps: string[] = [];
    const ask = vi.fn(async () => "{\"pass\":true,\"reason\":\"\"}");
    const result = await runBigThoughtIndividualChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      others: [{ code: "BT01", statement: "Another reason", label: "Other" }],
      carried: ["resolved", "relation"],
      ask,
      onStep: (checklist) => {
        const report = checklist.report;
        steps.push(report ? `${report.phase}:${report.gate}` : "blank");
      },
    });
    expect(ask).toHaveBeenCalledTimes(4);
    expect(String(ask.mock.calls[0]?.[0])).toContain("its job is a premise");
    expect(String(ask.mock.calls[3]?.[0])).toContain("Big Thoughts that already passed:");
    expect(steps[0]).toBe("checking:role");
    expect(steps).not.toContain("checking:resolved");
    expect(steps).not.toContain("checking:relation");
    expect(result.passed).toBe(true);
    expect(result.items.find((item) => item.id === "resolved")?.state).toBe("pass");
    expect(result.items.find((item) => item.id === "duplicate")?.state).toBe("pass");
  });

  it("passes the duplicate check without a model when no Big Thought has passed yet", async () => {
    const ask = vi.fn(async () => "{\"pass\":true,\"reason\":\"\"}");
    const result = await runBigThoughtIndividualChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      others: [],
      carried: ["resolved", "relation"],
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(String(ask.mock.calls.map((call) => call[0])).includes("Big Thoughts that already passed:")).toBe(false);
    expect(result.items.find((item) => item.id === "duplicate")?.state).toBe("pass");
  });

  it("asks the finished-claim check again after the sentence changes", () => {
    const prior = fixPriorForNextSentence(
      [
        { id: "resolved", state: "pass", reason: "" },
        { id: "relation", state: "pass", reason: "" },
        { id: "role", state: "pass", reason: "" },
        { id: "explains", state: "pending", reason: "" },
        { id: "premise", state: "pending", reason: "" },
        { id: "duplicate", state: "pending", reason: "" },
        { id: "sibling", state: "pending", reason: "" },
      ],
      "The old clause",
      "The new clause",
    );
    expect(prior.find((item) => item.id === "resolved")?.state).toBe("pending");
    expect(prior.find((item) => item.id === "relation")?.state).toBe("pending");
    expect(prior.find((item) => item.id === "role")?.state).toBe("pass");
  });
});

describe("Big Thought generate admission", () => {
  it("stops when the sentence is unfinished and does not ask the relation check", async () => {
    const ask = vi.fn(async () => "{\"pass\":false,\"reason\":\"It is only a heading.\"}");
    const result = await runGenerateAdmissionChecks({
      statement: "Integrasi data",
      parentStatement: "The master claim",
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.passed).toBe(false);
    expect(result.failure?.gate).toBe("resolved");
    expect(result.items.find((item) => item.id === "relation")?.state).toBe("unchecked");
    expect(result.items.find((item) => item.id === "duplicate")?.state).toBe("pass");
    expect(individualAdmission({ facts: factsForGenerateAdmission("Integrasi data", result), factsCurrent: true })).toBe(
      "UNRESOLVED",
    );
  });

  it("asks the relation check only after the sentence is finished", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce("{\"pass\":true,\"reason\":\"\"}")
      .mockResolvedValueOnce("{\"pass\":false,\"reason\":\"It restates the Master Thought.\"}");
    const result = await runGenerateAdmissionChecks({
      statement: "The same claim again",
      parentStatement: "The master claim",
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.failure?.gate).toBe("relation");
    expect(result.items.find((item) => item.id === "resolved")?.state).toBe("pass");
    expect(individualAdmission({ facts: factsForGenerateAdmission("The same claim again", result), factsCurrent: true })).toBe(
      "GENERATE_REJECT",
    );
  });

  it("admits a sentence after the finished-claim and relation checks pass", async () => {
    const ask = vi.fn(async () => "{\"pass\":true,\"reason\":\"\"}");
    const result = await runGenerateAdmissionChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(true);
    const facts = factsForGenerateAdmission("A distinct material reason", result);
    expect(facts.generatePasses).toEqual(["resolved", "relation"]);
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_VALID");
    expect(
      normalizeBigThoughtFacts({ ...facts, generatePasses: ["duplicate", "resolved", "relation"] }).generatePasses,
    ).toEqual(["resolved", "relation"]);
  });

  it("rejects an exact copy without a model call", () => {
    const result = generateDuplicateFailure("Same Big Thought as BT01.");
    expect(result.failure?.gate).toBe("duplicate");
    expect(result.items.find((item) => item.id === "resolved")?.state).toBe("unchecked");
    expect(individualAdmission({ facts: factsForGenerateAdmission("Same words", result), factsCurrent: true })).toBe(
      "GENERATE_REJECT",
    );
  });
});
