import { describe, expect, it } from "vitest";
import { asBecauseClause, becauseSentence } from "@/thinking-lab/big-thought/because";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { parseBigThoughtJudge } from "@/thinking-lab/big-thought/semantic";

const parent = "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.";

function judged(becauseForm: string, statement: string) {
  return parseBigThoughtJudge(
    JSON.stringify({
      code: "BT01",
      whatItSays: statement,
      relationToParent: "DISTINCT_MATERIAL_SUPPORT",
      supportRole: "REASON",
      explainsWhyParentIsTrue: true,
      introducesUnsupportedPremise: false,
      duplicateOfCode: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
      becauseForm,
    }),
    "BT01",
  );
}

describe("because clause", () => {
  it("joins a short subject to the reason by inserting karena", () => {
    expect(becauseSentence("Uang di usia muda lebih berharga ditabung", "keinginan modif punya masa kedaluwarsa")).toBe(
      "Uang di usia muda lebih berharga ditabung, karena keinginan modif punya masa kedaluwarsa.",
    );
  });

  it("joins the Master Thought to the reason by inserting karena", () => {
    const clause = "keinginan untuk modif dan balapan punya masa kedaluwarsa, sedangkan uang yang ditabung nggak";
    expect(becauseSentence(parent, clause)).toBe(
      "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang, karena keinginan untuk modif dan balapan punya masa kedaluwarsa, sedangkan uang yang ditabung nggak.",
    );
  });

  it("stores only the clause when the model repeats the Master Thought and the word because", () => {
    const full =
      "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang, karena keinginan untuk modif punya masa kedaluwarsa.";
    expect(asBecauseClause(full, parent)).toBe("keinginan untuk modif punya masa kedaluwarsa");
  });

  it("rejects a standalone claim that only sits after karena once it is rewritten", () => {
    const standalone = judged(
      "STANDALONE",
      "Bunga majemuk memberikan pertumbuhan eksponensial pada tabungan seiring berjalannya waktu.",
    );
    expect(standalone.relationToParent).toBe("ELABORATION");
    expect(individualAdmission({ facts: standalone, factsCurrent: true })).toBe("GENERATE_REJECT");
    const clause = judged("CLAUSE", "keinginan untuk modif punya masa kedaluwarsa, sedangkan uang yang ditabung nggak");
    expect(clause.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(individualAdmission({ facts: clause, factsCurrent: true })).toBe("GENERATE_VALID");
  });

  it("does not rejudge a stored row that has no because form", () => {
    const stored = parseBigThoughtJudge(
      JSON.stringify({
        code: "BT01",
        whatItSays: "An older support",
        relationToParent: "DISTINCT_MATERIAL_SUPPORT",
        supportRole: "REASON",
        explainsWhyParentIsTrue: true,
        introducesUnsupportedPremise: false,
        duplicateOfCode: null,
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
      "BT01",
    );
    expect(stored.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
  });
});
