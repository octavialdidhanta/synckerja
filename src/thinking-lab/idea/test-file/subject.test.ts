import { describe, expect, it } from "vitest";
import { ideaNodeSummary } from "@/thinking-lab/idea/subject";

describe("ideaNodeSummary", () => {
  it("keeps a short idea as its own label", () => {
    expect(ideaNodeSummary("Buka Terpal")).toBe("Buka Terpal");
    expect(ideaNodeSummary("Foto Dulu")).toBe("Foto Dulu");
  });

  it("summarizes a long situation instead of the full sentence", () => {
    expect(
      ideaNodeSummary(
        "Kita menampilkan seorang individu yang pensiun di usia 40-an, bukan untuk berdiam diri, melainkan untuk mendirikan sebuah yayasan.",
      ),
    ).toBe("Pensiun di usia 40-an");
    expect(
      ideaNodeSummary(
        "Kita mengundang beberapa orang yang telah pensiun dini untuk berbagi cerita tentang bagaimana mereka kini menjadi mentor bagi startup-startup muda, bukan karena terpaksa, melainkan karena memiliki kebebasan finansial.",
      ),
    ).toBe("Pensiun dini berbagi cerita");
    expect(
      ideaNodeSummary(
        "Kita menciptakan sebuah skenario di mana seorang individu, setelah pensiun dini, mendedikasikan waktunya untuk mengembangkan kebun komunitas yang menyediakan pangan gratis bagi warga sekitar.",
      ),
    ).toBe("Mengembangkan kebun komunitas");
    expect(
      ideaNodeSummary(
        "Kita menunjukkan seorang mantan profesional yang pensiun dini dan kini menghabiskan waktunya untuk menulis buku-buku inspiratif atau menciptakan karya seni yang mendidik, menjelaskan bahwa kebebasan itu datang dari menabung.",
      ),
    ).toBe("Mantan profesional menulis buku-buku inspiratif");
    expect(
      ideaNodeSummary(
        "Kita membuat sebuah simulasi di mana dua individu dengan gaji awal yang sama memilih jalur berbeda: satu menghabiskan, satu menabung.",
      ),
    ).toBe("Dua individu dengan gaji awal sama");
  });

  it("keeps the mechanism when the sentence is a story, a comparison, or a simulation", () => {
    expect(
      ideaNodeSummary(
        "Sebuah proyek multi-departemen dimulai dengan instruksi tertulis yang lengkap, namun ketika hambatan tak terduga muncul, kita mengamati bagaimana proyek hanya dapat dilanjutkan setelah seorang individu secara proaktif mencari solusi dan mengkoordinasikan ulang antar departemen.",
      ),
    ).toBe("Proyek dilanjutkan setelah individu proaktif mencari");
    expect(
      ideaNodeSummary(
        "Kita menciptakan skenario di mana dua departemen harus berkolaborasi tanpa adanya protokol komunikasi resmi, dan mengamati bagaimana keberhasilan kolaborasi sepenuhnya bergantung pada upaya seorang individu.",
      ),
    ).toBe("Dua departemen harus berkolaborasi tanpa protokol");
    expect(
      ideaNodeSummary(
        "Kita membandingkan waktu dan upaya yang dihabiskan oleh seorang manajer untuk secara manual mengkoordinasikan tugas-tugas rutin antar departemen setiap hari, dengan waktu yang dibutuhkan jika ada sistem otomatis yang menangani sebagian besar koordinasi tersebut.",
      ),
    ).toBe("Manajer manual dengan sistem otomatis");
    expect(
      ideaNodeSummary(
        "Kita mensimulasikan situasi di mana seorang koordinator informal yang selalu berinisiatif untuk menyelaraskan pekerjaan antar departemen tiba-tiba tidak hadir, dan mengamati bagaimana alur kerja terhenti.",
      ),
    ).toBe("Koordinator informal tidak hadir");
  });
});
