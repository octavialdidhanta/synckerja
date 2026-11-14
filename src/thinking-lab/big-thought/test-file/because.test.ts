import { describe, expect, it } from "vitest";
import { asBecauseClause, becauseSentence } from "@/thinking-lab/big-thought/because";

const parent = "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.";

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
});

describe("becauseConnector language", () => {
  it("reads an Indonesian reason without the first joining words as Indonesian", async () => {
    const { becauseConnector } = await import("@/thinking-lab/big-thought/because");
    expect(becauseConnector("lemak kambing muda masih terselip di dalam serat dagingnya, bukan menumpuk di luar seperti pada kambing tua")).toBe("karena");
    expect(becauseConnector("the fat sits inside the fibers of young goat meat")).toBe("because");
  });
});
