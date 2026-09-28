import { describe, expect, it } from "vitest";
import { angleNodeSubject } from "@/thinking-lab/angle/subject";

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
});
