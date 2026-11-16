import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type CarouselSlide } from "./canvaCarouselBrief.ts";
import {
  collectPageTextsFromAny,
  collectPageTextsFromDesign,
  collectPageTextsFromFlatBadgeDump,
  collectPageTextsFromGetDesignContent,
  normalizeCarouselText,
  orderCarouselPages,
} from "./canvaCarouselPageOrder.ts";

function slide(headline: string, copy = ""): CarouselSlide {
  return {
    label: "Slide",
    scene: "Scene",
    copy,
    elements: `Headline: ${headline}`,
    tagging: "",
  };
}

Deno.test("normalizeCarouselText collapses punctuation and case", () => {
  assertEquals(normalizeCarouselText("Siap Hadapi Perubahan?"), "siap hadapi perubahan");
});

Deno.test("orderCarouselPages remaps scrambled Canva pages to brief order", () => {
  const slides = [
    slide("Kebijakan baru bikin ribet? Nggak lagi!", "Kebijakan baru? Jangan sampai bikin alur kerja jadi kacau."),
    slide("Simulasi Perubahan Kebijakan", "Lihat langsung dampak perubahan sebelum diterapkan."),
    slide("Uji Skenario, Pilih yang Terbaik", "Uji skenario berbeda, temukan yang paling efisien."),
    slide("Kolaborasi Tim, Keputusan Akurat", "Libatkan tim, ambil keputusan berbasis data."),
    slide("Implementasi Mulus, Tanpa Hambatan", "Implementasi otomatis, minim kesalahan manusia."),
    slide("Pantau Kinerja, Ukur Dampak Nyata", "Pantau kinerja, pastikan kebijakan berjalan efektif."),
    slide("Siap Hadapi Perubahan?", "Ubah birokrasi jadi efisiensi, yuk coba sekarang!"),
    slide("Synckerja Office", "Solusi ERP terintegrasi untuk bisnis yang adaptif."),
  ];
  const pageTexts = new Map<number, string[]>([
    [1, []],
    [2, ["Siap Hadapi Perubahan?", "Ubah birokrasi jadi efisiensi, yuk coba sekarang!"]],
    [3, ["Pantau Kinerja, Ukur Dampak Nyata"]],
    [4, ["Kebijakan baru bikin ribet? Nggak lagi!"]],
    [5, ["Simulasi Perubahan Kebijakan"]],
    [6, ["Uji Skenario, Pilih yang Terbaik"]],
    [7, ["Kolaborasi Tim, Keputusan Akurat"]],
    [8, ["Implementasi Mulus, Tanpa Hambatan"]],
    [9, ["Synckerja Office", "https://synckerja.com/"]],
  ]);
  const result = orderCarouselPages(slides, pageTexts);
  assertEquals(result?.orderedPageNumbers, [4, 5, 6, 7, 8, 3, 2, 9]);
  assertEquals(result?.droppedBlanks, [1]);
  assertEquals(result?.matched[0].slide, 1);
  assertEquals(result?.matched[6].page, 2);
});

Deno.test("orderCarouselPages returns null when a headline is missing", () => {
  const slides = [
    slide("Kebijakan baru bikin ribet? Nggak lagi!"),
    slide("Simulasi Perubahan Kebijakan"),
  ];
  const pageTexts = new Map<number, string[]>([
    [1, ["Siap Hadapi Perubahan?"]],
    [2, ["Siap Hadapi Perubahan?", "duplikat"]],
  ]);
  assertEquals(orderCarouselPages(slides, pageTexts), null);
});

Deno.test("orderCarouselPages keeps identity when already ordered", () => {
  const slides = [
    slide("Hook satu"),
    slide("Hook dua"),
    slide("Hook tiga"),
  ];
  const pageTexts = new Map<number, string[]>([
    [1, ["Hook satu"]],
    [2, ["Hook dua"]],
    [3, ["Hook tiga"]],
  ]);
  assertEquals(orderCarouselPages(slides, pageTexts)?.orderedPageNumbers, [1, 2, 3]);
});

Deno.test("collectPageTextsFromDesign reads design_content pages", () => {
  const payload = {
    design_content: {
      pages: [
        { elements: [{ text: "Alpha headline", type: "text" }] },
        { elements: [{ textRegions: [{ characters: "Beta line" }], type: "text" }] },
      ],
    },
  };
  const map = collectPageTextsFromDesign(payload);
  assertEquals(map.get(1), ["Alpha headline"]);
  assertEquals(map.get(2), ["Beta line"]);
});

Deno.test("collectPageTextsFromGetDesignContent reads richtexts per page", () => {
  const map = collectPageTextsFromGetDesignContent({
    pages: [
      { page_number: 1, richtexts: [{ plaintext: "Angka Doang vs. Angka + Aktivitas Tim" }] },
      { page_number: 2, richtexts: [{ text: "Tingkatkan Performa Bisnismu" }] },
      { page_number: 5, richtexts: [{ plain_text: "Angka Saja, Tanpa Konteks" }] },
    ],
  });
  assertEquals(map.get(1), ["Angka Doang vs. Angka + Aktivitas Tim"]);
  assertEquals(map.get(2), ["Tingkatkan Performa Bisnismu"]);
  assertEquals(map.get(5), ["Angka Saja, Tanpa Konteks"]);
});

Deno.test("orderCarouselPages remaps Angka-style scramble to brief order", () => {
  const slides = [
    slide("Angka Doang vs. Angka + Aktivitas Tim", "Lihat bedanya laporan penjualan."),
    slide("Angka Saja, Tanpa Konteks", "Laporan cuma angka bikin kamu cuma bisa nebak-nebak."),
    slide("Angka + Aktivitas = Insight", "Dengan aktivitas, kamu tahu persis."),
    slide("Evaluasi Kinerja Lebih Akurat", "Identifikasi tim mana yang paling produktif."),
    slide("Rencanakan Strategi Jitu", "Buat strategi penjualan yang lebih tepat sasaran."),
    slide("Laporan Lengkap di Synckerja Office", "Synckerja Office bantu kamu lihat laporan."),
    slide("Tingkatkan Performa Bisnismu", "Ambil keputusan bisnis yang lebih cerdas."),
    slide("Ingin Laporan Lebih Insightful?", "Kunjungi website kami untuk demo gratis!"),
    slide("Synckerja Office", "Measuring Performance, Connecting Progress"),
  ];
  const pageTexts = new Map<number, string[]>([
    [1, ["Angka Doang vs. Angka + Aktivitas Tim"]],
    [2, ["Tingkatkan Performa Bisnismu", "Dengan Data yang Lebih Mendalam"]],
    [3, ["Ingin Laporan Lebih Insightful?"]],
    [4, ["Synckerja Office", "Measuring Performance, Connecting Progress", "https://synckerja.com/"]],
    [5, ["Angka Saja, Tanpa Konteks", "Penjualan Naik/Turun, Tapi Kenapa?"]],
    [6, ["Angka + Aktivitas = Insight"]],
    [7, ["Evaluasi Kinerja Lebih Akurat"]],
    [8, ["Rencanakan Strategi Jitu"]],
    [9, ["Laporan Lengkap di Synckerja Office"]],
  ]);
  const result = orderCarouselPages(slides, pageTexts, {
    brandName: "Synckerja Office",
    tagline: "Measuring Performance, Connecting Progress",
    facts: ["https://synckerja.com/", "081118891308"],
  });
  assertEquals(result?.orderedPageNumbers, [1, 5, 6, 7, 8, 9, 2, 3, 4]);
});

Deno.test("orderCarouselPages returns null when page texts are empty", () => {
  const slides = [slide("Hook satu"), slide("Hook dua")];
  assertEquals(orderCarouselPages(slides, new Map()), null);
});

Deno.test("collectPageTextsFromFlatBadgeDump splits Canva MCP page markers", () => {
  const dump = [
    "Laporan Historis Aja vs. Prediktif",
    "1/8",
    "Cuma Lihat Angka Masa Lalu?",
    "2/8",
    "Siap Hadapi Skenario",
    "3 / 8",
    "Prediksi Dampak Finansial",
    "4/8",
  ].join("\n");
  const map = collectPageTextsFromFlatBadgeDump(dump);
  assertEquals([...map.keys()].sort((a, b) => a - b), [1, 2, 3, 4]);
  assertEquals(map.get(1)?.[0]?.includes("Laporan Historis"), true);
  assertEquals(map.get(2)?.[0]?.includes("Cuma Lihat"), true);
  assertEquals(map.get(3)?.[0]?.includes("Siap Hadapi"), true);
  assertEquals(map.get(4)?.[0]?.includes("Prediksi Dampak"), true);
});

Deno.test("collectPageTextsFromAny reads MCP content[] flat dump", () => {
  const map = collectPageTextsFromAny({
    content: [{
      type: "text",
      text: "Hook page satu\n1/8\nHook page dua\n2/8\n",
    }],
  });
  assertEquals(map.get(1)?.some((t) => t.includes("Hook page satu")), true);
  assertEquals(map.get(2)?.some((t) => t.includes("Hook page dua")), true);
});

Deno.test("orderCarouselPages matches Synkerja typo to Synckerja brief", () => {
  const slides = [
    slide("Synckerja Office: Laporan Prediktif"),
    slide("Synckerja Office"),
  ];
  const pageTexts = new Map<number, string[]>([
    [1, ["Synkerja Office: Laporan Prediktif"]],
    [2, ["Synkerja Office", "Measuring Performance, Connecting Progress"]],
  ]);
  const result = orderCarouselPages(slides, pageTexts, {
    brandName: "Synckerja Office",
    tagline: "Measuring Performance, Connecting Progress",
    facts: ["https://synckerja.com/"],
  });
  assertEquals(result?.orderedPageNumbers, [1, 2]);
});
