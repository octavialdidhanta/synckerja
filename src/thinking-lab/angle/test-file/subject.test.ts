import { describe, expect, it } from "vitest";
import { angleListSubject, angleNodeSubject, angleSubjectCopiesTerritory, angleSubjectProblem } from "@/thinking-lab/angle/subject";

const territory = "Pakaian tren musiman";

describe("angleNodeSubject", () => {
  it("names the observation instead of the full contrast sentence", () => {
    expect(
      angleNodeSubject(
        "Pakaian tren musiman mendorong pembelian berulang, namun justru menciptakan beban penyimpanan atau pembuangan yang terus-menerus.",
        territory,
      ),
    ).toBe("Pembelian berulang");
    expect(
      angleNodeSubject(
        "Pakaian tren musiman menjanjikan identitas, namun justru menuntut penyeragaman yang berulang.",
        territory,
      ),
    ).toBe("Identitas");
    expect(
      angleNodeSubject(
        "Pakaian tren musiman dirancang untuk momen estetika tertentu, namun seringkali mengabaikan fungsi dasar dan ketahanan pakai.",
        territory,
      ),
    ).toBe("Momen estetika tertentu");
  });

  it("keeps a subject that is already short", () => {
    expect(angleNodeSubject("Motor kebanggaan kini nganggur", "Mantan anak motor")).toBe(
      "Motor kebanggaan kini nganggur",
    );
  });

  it("finishes the observation instead of cutting it on an open word", () => {
    expect(
      angleNodeSubject("Informasi yang tidak bisa diakses seketika sama saja dengan tidak ada."),
    ).toBe("Informasi yang tidak bisa diakses seketika");
  });
});

describe("angle list subject", () => {
  it("keeps a short name and rejects the Territory name or a sentence opening", () => {
    expect(angleSubjectCopiesTerritory('"Tugas dapur"', "Tugas dapur")).toBe(true);
    expect(angleSubjectCopiesTerritory("Limbah tersembunyi", "Tugas dapur")).toBe(false);
    expect(angleSubjectProblem("Secara tidak terduga membebani", "Tugas dapur")).toBe(
      "The subject must be a short name that can be read on its own.",
    );
    expect(angleSubjectProblem("Sering dianggap sebagai sumber", "Tugas dapur")).toBe(
      "The subject must be a short name that can be read on its own.",
    );
    expect(angleSubjectProblem("", "Tugas dapur")).toBe("This Angle has no short subject.");
    expect(angleListSubject("Keputusan mikro", "Tugas dapur")).toBe("Keputusan mikro");
    expect(angleListSubject("Tugas dapur", "Tugas dapur")).toBe("");
  });
});
