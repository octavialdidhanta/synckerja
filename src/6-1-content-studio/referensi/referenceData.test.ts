import { describe, expect, it } from "vitest";
import { fmtT, motionKinds, parseReference, standardLine, unanalyzedFiles } from "./referenceData";

const r4 = parseReference("r4", {
  judul: "Rocky's BBQ — \"Masa kehabisan mulu\"",
  kreator: "@rockys",
  durasi: 66.3,
  ada_vo: true,
  bahasa: "Indonesia",
  file: "ref_rockys-bbq_masa-kehabisan_cewek.mp4",
  struktur: [{ a: 0, b: 7, bagian: "Hook (kelangkaan)", isi: "Dua kali datang…" }],
  vo: [{ a: 0, b: 2.6, t: "Dua kali datang ke sini" }],
  kenapa: ["Kelangkaan"],
  editing: ["Cut cepat"],
  beats: [
    {
      a: 0,
      b: 3,
      hook: true,
      peran: "Hook",
      jenis: "Proses dramatis",
      visual: "Asap",
      kenapa: "Gerakan besar",
      storage_path: "org/thumbs/references/r4/refb_r4_00.jpg",
      sate: { ide: "Kipas bara", action: "Close-up…", lokasi: "pik1-foodcourt", produk: "sate-kambing", area: "Panggangan" },
    },
  ],
  mg: [
    {
      a: 0.5,
      b: 63.4,
      jenis: "Subtitle",
      nama: "Subtitle krem",
      animasi: "Tanpa animasi.",
      font: { asli: "Sans bulat", mirip: ["Poppins Bold", "Montserrat Bold"], warna: ["#FAF8B2", "#282000"] },
      storage_path: "org/thumbs/references/r4/refmg_r4_00.jpg",
      sample_storage_path: "org/thumbs/references/r4/refmg_r4_00_sate.jpg",
      cara_bikin: "Remotion",
    },
    { a: 1, b: 2, jenis: "Teks di belakang orang", nama: "Behind" },
    { a: 1, b: 2, nama: "Tanpa jenis" },
  ],
});

describe("referenceData", () => {
  it("parses the referensi.json shape with storage paths and cara bikin", () => {
    expect(r4).toMatchObject({ id: "r4", adaVo: true, durasi: 66.3, file: "ref_rockys-bbq_masa-kehabisan_cewek.mp4" });
    expect(r4.beats[0]).toMatchObject({ index: 0, hook: true, thumbPath: "org/thumbs/references/r4/refb_r4_00.jpg", sate: { produk: "sate-kambing" } });
    expect(r4.mg[0]).toMatchObject({ cara: "Remotion", samplePath: "org/thumbs/references/r4/refmg_r4_00_sate.jpg", font: { mirip: ["Poppins Bold", "Montserrat Bold"] } });
    expect(r4.mg[2].jenis).toBe("Lainnya");
    expect(parseReference("r9", {})).toMatchObject({ judul: "r9", beats: [], mg: [], vo: [] });
  });

  it("orders motion graphic filters like the step list, with counts", () => {
    expect(motionKinds(r4.mg)).toEqual([
      { jenis: "Subtitle", n: 1 },
      { jenis: "Teks di belakang orang", n: 1 },
      { jenis: "Lainnya", n: 1 },
    ]);
  });

  it("writes the Jadiin standar line like katalog.html mgStd()", () => {
    expect(standardLine(r4, r4.mg[0])).toBe(
      "- Subtitle (dari Rocky's BBQ): Subtitle krem. Tanpa animasi. Font mirip Poppins Bold, warna #FAF8B2 / #282000.",
    );
  });

  it("lists videos in the folder that no reference uses yet", () => {
    expect(unanalyzedFiles(["desktop.ini", "REF_ROCKYS-BBQ_masa-kehabisan_cewek.mp4", "baru.MOV", "catatan.txt"], [r4])).toEqual(["baru.MOV"]);
  });

  it("formats seconds as m:ss", () => {
    expect(fmtT(66.3)).toBe("1:06");
    expect(fmtT(0)).toBe("0:00");
  });
});
