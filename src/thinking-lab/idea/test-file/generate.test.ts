import { describe, expect, it } from "vitest";
import { buildIdeaGeneratePrompt, nextIdeaCode, parseGeneratedIdeaDrafts, runIdeaGenerate, type IdeaDraft } from "@/thinking-lab/idea/generate";
import { IDEA_CHECK_IDS } from "@/thinking-lab/idea/check/ids";
import { readIdeaValidation } from "@/thinking-lab/idea/check/record";
import { canReviseIdea } from "@/thinking-lab/idea/revise";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

const parent = { id: "a1", code: "AN01", statement: "Orang menyalahkan bumbu, padahal masalahnya di api.", angleFingerprint: "fp" };

function validation(decision: "LOLOS" | "DITOLAK") {
  return readIdeaValidation({
    schema: "thinking-lab/idea-validation/v1",
    generatorVersion: "idea-checks/v2",
    decision,
    criteria:
      decision === "LOLOS"
        ? IDEA_CHECK_IDS.map((id) => ({ id, status: "PASS", reason: "" }))
        : [{ id: "mechanism", status: "FAIL", reason: "Masih pengamatan." }],
    statement: "",
    validatedAt: "2026-11-14T00:00:00.000Z",
  })!;
}

const draft = (statement: string): IdeaDraft => ({ title: "", statement, mechanismKeys: [], concept: "", mechanism: "", value: "" });

type Row = { code: string; statement: string; admission: IndividualAdmission; angleId: string; locked?: boolean };

describe("Idea generate", () => {
  it("proposes, checks, and saves one sentence at a time, at most three per run", async () => {
    const proposals = ["Kita A sehingga B.", "Kita C sehingga D.", "Kita E sehingga F.", "Kita G sehingga H."];
    const seen: number[] = [];
    const saved: Array<{ code: string; admission: IndividualAdmission }> = [];
    const result = await runIdeaGenerate<Row>({
      loadParent: async () => ({ ok: true, parent }),
      incumbents: [],
      propose: async (_parent, incumbents) => {
        seen.push(incumbents.length);
        return draft(proposals[incumbents.length] ?? "");
      },
      check: async (_parent, next) => validation(next.statement.startsWith("Kita C") ? "DITOLAK" : "LOLOS"),
      persist: async ({ code, draft: next, admission }) => {
        saved.push({ code, admission });
        return { code, statement: next.statement, admission, angleId: parent.id };
      },
    });
    expect(seen).toEqual([0, 1, 2]);
    expect(saved).toEqual([
      { code: "ID01", admission: "GENERATE_VALID" },
      { code: "ID02", admission: "GENERATE_REJECT" },
      { code: "ID03", admission: "GENERATE_VALID" },
    ]);
    expect(result.outcome).toBe("INSUFFICIENT_VALID_IDEAS");
    expect(result.generateValid).toBe(2);
  });

  it("skips a sentence that repeats a saved Idea and stops when nothing comes back", async () => {
    const incumbents: Row[] = [{ code: "ID01", statement: "Kita A sehingga B.", admission: "GENERATE_VALID", angleId: parent.id }];
    let checked = 0;
    let calls = 0;
    await runIdeaGenerate<Row>({
      loadParent: async () => ({ ok: true, parent }),
      incumbents,
      propose: async () => (++calls === 1 ? draft("Kita A sehingga B.") : null),
      check: async () => {
        checked += 1;
        return validation("LOLOS");
      },
      persist: async () => {
        throw new Error("not saved");
      },
    });
    expect(calls).toBe(2);
    expect(checked).toBe(0);
  });

  it("returns the parent denial without proposing", async () => {
    const result = await runIdeaGenerate<Row>({
      loadParent: async () => ({ ok: false, reason: "PARENT_UNLOCKED" }),
      incumbents: [],
      propose: async () => {
        throw new Error("not asked");
      },
      check: async () => validation("LOLOS"),
      persist: async () => {
        throw new Error("not saved");
      },
    });
    expect(result).toMatchObject({ outcome: "DENIED", reason: "PARENT_UNLOCKED" });
  });

  it("asks for keys and allows a situation that unfolds over time", () => {
    const prompt = buildIdeaGeneratePrompt({ parentStatement: parent.statement, incumbents: [], failures: [], masterSubject: "cara sate dibakar" });
    expect(prompt).toContain('"keys":[{"otherExplanation":"...","close":"..."}]');
    expect(prompt).toContain("A situation may unfold over time");
    expect(prompt).toContain("Master Thought subject: cara sate dibakar");
  });

  it("reads drafts with their keys and numbers the next code", () => {
    const [read] = parseGeneratedIdeaDrafts({
      ideas: [{ title: "Cicip buta", statement: "Kita A sehingga B.", keys: [{ otherExplanation: "Lapar", close: "Sama-sama kenyang" }] }],
    });
    expect(read?.title).toBe("Cicip buta");
    expect(read?.mechanismKeys).toEqual([{ otherExplanation: "Lapar", close: "Sama-sama kenyang" }]);
    expect(nextIdeaCode(["ID01", "ID09"])).toBe("ID10");
  });

  it("allows three revisions of a card that has not passed", () => {
    const rows = [{ id: "i1", parentIdeaId: null }];
    expect(canReviseIdea(rows[0], rows, "DITOLAK", 2)).toBe(true);
    expect(canReviseIdea(rows[0], rows, "DITOLAK", 3)).toBe(false);
    expect(canReviseIdea(rows[0], rows, "LOLOS", 0)).toBe(false);
  });
});
