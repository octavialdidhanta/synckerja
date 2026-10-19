import { describe, expect, it, vi } from "vitest";
import {
  buildAnsweredQuestionPrompt,
  buildAnsweredQuestionScopePrompt,
  buildMasterAnswerabilityPrompt,
  parseAnsweredQuestion,
  parseAnsweredQuestionScope,
  parseMasterAnswerability,
  resolveAnsweredQuestion,
} from "@/thinking-lab/big-thought/answeredQuestion";

describe("answered question", () => {
  it("asks for the question the audience already has", () => {
    const prompt = buildAnsweredQuestionPrompt({
      master: "Tidak memakai sistem justru lebih boros.",
      reason: "biaya terbesar tersembunyi dalam ribuan keputusan kecil",
      audience: "pemilik bisnis",
    });
    expect(prompt).toContain("Indonesian");
    expect(prompt).toContain("pemilik bisnis");
    expect(prompt).toContain("specific to this reason");
    expect(prompt).toContain("before this reason, is too broad");
    expect(prompt).toContain("Do not write the because-clause");
  });

  it("keeps one short question", () => {
    const question = parseAnsweredQuestion(
      '{"question":"kalau sistemnya mahal, borosnya yang mana?"}',
      "biaya terbesar tersembunyi dalam ribuan keputusan kecil",
    );
    expect(question).toBe("kalau sistemnya mahal, borosnya yang mana?");
  });

  it("drops a question that copies the Big Thought", () => {
    const reason = "biaya terbesar tersembunyi dalam ribuan keputusan kecil yang dibuat berulang-ulang";
    expect(parseAnsweredQuestion(`{"question":"${reason}?"}`, reason)).toBe("");
  });

  it("drops a question that repeats the Master Thought conclusion", () => {
    const master =
      "Meskipun sistem dianggap mahal, bisnis yang tidak memakainya justru akan membuang lebih banyak sumber daya penting.";
    const question = "apa yang menyebabkan pemborosan sumber daya jika bisnis tidak memiliki sistem?";
    expect(parseAnsweredQuestion(`{"question":"${question}"}`, "tidak ada panduan yang jelas untuk setiap langkah kerja", master)).toBe(
      "",
    );
  });

  it("keeps a question that this Big Thought answers", () => {
    const master =
      "Meskipun sistem dianggap mahal, bisnis yang tidak memakainya justru akan membuang lebih banyak sumber daya penting.";
    expect(
      parseAnsweredQuestion(
        '{"question":"langkah berikutnya yang mana?"}',
        "tidak ada panduan yang jelas untuk setiap langkah kerja",
        master,
      ),
    ).toBe("langkah berikutnya yang mana?");
  });

  it("drops a rephrased Master Thought question", () => {
    const master =
      "Meskipun sistem dianggap mahal, bisnis yang tidak memakainya justru akan membuang lebih banyak sumber daya penting.";
    const question = "apa penyebab utama pemborosan sumber daya dalam operasional bisnis saya?";
    expect(
      parseAnsweredQuestion(`{"question":"${question}"}`, "tidak ada panduan yang jelas untuk setiap langkah kerja", master),
    ).toBe("");
  });

  it("asks again without repeating a rejected question", () => {
    const prompt = buildAnsweredQuestionPrompt({
      master: "Tidak memakai sistem justru lebih boros.",
      reason: "tidak ada panduan yang jelas untuk setiap langkah kerja",
      rejected: ["apa penyebab utama pemborosan sumber daya dalam operasional bisnis saya?"],
    });
    expect(prompt).toContain("Do not write them again, and do not rephrase them");
    expect(prompt).toContain("apa penyebab utama pemborosan sumber daya dalam operasional bisnis saya?");
  });

  it("keeps a question only when the scope is this Big Thought", () => {
    expect(parseAnsweredQuestionScope('{"scope":"REASON"}')).toBe("REASON");
    expect(parseAnsweredQuestionScope('{"scope":"MASTER"}')).toBe("MASTER");
    expect(parseAnsweredQuestionScope("not json")).toBe("UNRESOLVED");
    const prompt = buildAnsweredQuestionScopePrompt({
      master: "Tidak memakai sistem justru lebih boros.",
      reason: "tidak ada panduan yang jelas untuk setiap langkah kerja",
      question: "langkah berikutnya yang mana?",
    });
    expect(prompt).toContain("even when the words are different");
    expect(prompt).toContain("langkah berikutnya yang mana?");
  });

  it("keeps a question only when the Master Thought cannot answer it", () => {
    expect(parseMasterAnswerability('{"answerable":false}')).toBe("NEEDS_REASON");
    expect(parseMasterAnswerability('{"answerable":true}')).toBe("ANSWERABLE");
    expect(parseMasterAnswerability("not json")).toBe("UNRESOLVED");
    const prompt = buildMasterAnswerabilityPrompt({
      master: "Tidak memakai sistem justru lebih boros.",
      reason: "terjadi tumpang tindih pekerjaan dan kurangnya koordinasi antar bagian",
      question: "bagaimana ketidakhadiran sistem menyebabkan inefisiensi operasional?",
    });
    expect(prompt).toContain("the Master Thought alone is enough");
    expect(prompt).toContain("still needs this Big Thought's reason");
    expect(prompt).toContain("bagaimana ketidakhadiran sistem menyebabkan inefisiensi operasional?");
    expect(prompt).not.toContain("orang");
  });

  it("asks again when the first question only restates the Master Thought", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("Decide which sentence")) return '{"scope":"REASON"}';
      if (prompt.includes("answerable is true")) return '{"answerable":false}';
      if (prompt.includes("Do not write them again")) return '{"question":"biaya listrik yang mana yang belum masuk hitungan?"}';
      return '{"question":"Apakah membawa bekal selalu lebih hemat?"}';
    });
    const question = await resolveAnsweredQuestion({
      master: "Ternyata anggapan bahwa membawa bekal selalu lebih hemat adalah keliru.",
      reason: "biaya penggunaan listrik atau gas untuk menyiapkan bekal sering tidak diperhitungkan",
      ask,
    });
    expect(question).toBe("biaya listrik yang mana yang belum masuk hitungan?");
    expect(ask.mock.calls[1]?.[0]).toContain("Apakah membawa bekal selalu lebih hemat?");
  });
});
