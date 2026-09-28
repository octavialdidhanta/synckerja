import { describe, expect, it } from "vitest";
import { masterBeliefDescription } from "@/thinking-lab/master-thought/description";

const planted =
  "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang dan modif paling epik.";

describe("master belief description", () => {
  it("states the planted belief as what the audience should believe", () => {
    expect(masterBeliefDescription(planted, "remaja laki-laki")).toBe(
      "Kita ingin remaja laki-laki percaya bahwa uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang dan modif paling epik.",
    );
  });

  it("uses the English frame when the belief is English", () => {
    expect(
      masterBeliefDescription("Saving young beats spending it on the fastest bike.", "teenage boys"),
    ).toBe("We want teenage boys to believe that saving young beats spending it on the fastest bike.");
  });

  it("keeps a belief that starts with capitals when embedding it", () => {
    expect(masterBeliefDescription("OKR adalah arah kerja tim.", "manajer")).toBe(
      "Kita ingin manajer percaya bahwa OKR adalah arah kerja tim.",
    );
  });

  it("returns the planted belief unchanged when there is no audience", () => {
    expect(masterBeliefDescription(planted, "")).toBe(planted);
    expect(masterBeliefDescription(planted, "   ")).toBe(planted);
  });
});
