import { describe, expect, it } from "vitest";
import { territoryLinkInstruction, territoryQuestionSentence } from "@/thinking-lab/territory/link";

describe("territoryQuestionSentence", () => {
  it("says what happens there, then the question people ask", () => {
    expect(
      territoryQuestionSentence(
        "Manajemen inventaris",
        "Apakah sumber daya saya terbuang percuma?",
        "",
        "Para pemilik bisnis mendapati barang dagangan mereka sering tidak sinkron antara catatan dan ketersediaan fisik di gudang.",
      ),
    ).toBe(
      "Di Manajemen inventaris, para pemilik bisnis mendapati barang dagangan mereka sering tidak sinkron antara catatan dan ketersediaan fisik di gudang. Lalu ia bertanya: apakah sumber daya saya terbuang percuma?",
    );
  });

  it("asks the question in the place when the scene is not known yet", () => {
    expect(territoryQuestionSentence("Keputusan harian", "kalau sistemnya mahal, borosnya yang mana?")).toBe(
      "Di Keputusan harian, pertanyaannya: kalau sistemnya mahal, borosnya yang mana?",
    );
  });

  it("follows an Indonesian Master Thought when the question has no connector word", () => {
    expect(
      territoryQuestionSentence("Gaptek", "salah orangnya atau alatnya?", "Teknologi membuat orang bisa melakukan hal yang luar biasa."),
    ).toBe("Di Gaptek, pertanyaannya: salah orangnya atau alatnya?");
  });

  it("joins an English question with people ask", () => {
    expect(territoryQuestionSentence("monthly market run", "where does the money go?")).toBe(
      "In monthly market run, the question is: where does the money go?",
    );
  });

  it("returns nothing when the question is missing", () => {
    expect(territoryQuestionSentence("Keputusan harian", "  ")).toBe("");
    expect(territoryQuestionSentence("", "borosnya yang mana?")).toBe("");
  });
});

describe("territoryLinkInstruction", () => {
  it("names the sentence the writer must make true", () => {
    const line = territoryLinkInstruction("kalau sistemnya mahal, borosnya yang mana?");
    expect(line).toContain("noun or a noun phrase only");
    expect(line).toContain("kalau sistemnya mahal, borosnya yang mana?");
    expect(line).toContain("Kurir paket is the shape of the name");
    expect(line).toContain("Write the name only");
  });

  it("keeps the question slot when the question is not known yet", () => {
    const line = territoryLinkInstruction("", "Waktu untuk pertumbuhan investasi lebih panjang.");
    expect(line).toContain("the question this Big Thought answers comes up in real life");
  });
});
