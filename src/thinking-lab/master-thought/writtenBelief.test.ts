import { describe, expect, it } from "vitest";
import {
  buildBeliefOptionsPrompt,
  buildWrittenBeliefCheckPrompt,
  checkWrittenBelief,
  parseWrittenBeliefCheck,
} from "@/thinking-lab/master-thought/semantic";

const wagyu = "Sate kambing muda Sate Sultan PIK berani diadu juicy-nya sama wagyu MB7–MB9. Nggak puas? Kami garansi rasa.";

describe("written Master Thought check", () => {
  it("asks one claim, one sentence, not a promotion, and the shift when an old belief exists", () => {
    const prompt = buildWrittenBeliefCheckPrompt({ belief: wagyu, priorBelief: "Sate kambing cuma makanan murah." });
    expect(prompt).toContain("oneClaim:");
    expect(prompt).toContain("oneSentence:");
    expect(prompt).toContain("notPromo:");
    expect(prompt).toContain("A product claim may be the belief.");
    expect(prompt).toContain("shift:");
  });

  it("returns the reasons of failed checks and refuses an answer that skips a check", () => {
    const ids = ["oneClaim", "oneSentence", "notPromo"];
    expect(
      parseWrittenBeliefCheck(
        { checks: [{ id: "oneClaim", pass: true }, { id: "oneSentence", pass: false, reason: "Tiga kalimat." }, { id: "notPromo", pass: false, reason: "Kami garansi rasa." }] },
        ids,
      ),
    ).toEqual({ pass: false, reasons: ["Tiga kalimat.", "Kami garansi rasa."] });
    expect(parseWrittenBeliefCheck({ checks: [{ id: "oneClaim", pass: true }] }, ids)).toBeNull();
  });

  it("an unreadable answer twice never lets the belief through", async () => {
    let calls = 0;
    const result = await checkWrittenBelief({ belief: wagyu }, async () => {
      calls += 1;
      return "not json";
    });
    expect(calls).toBe(2);
    expect(result).toEqual({ pass: false, reasons: ["UNDECIDED"] });
  });

  it("belief options leave the promotion out", () => {
    expect(buildBeliefOptionsPrompt({ planted: wagyu })).toContain("Do not carry the promotion into any belief.");
  });
});
