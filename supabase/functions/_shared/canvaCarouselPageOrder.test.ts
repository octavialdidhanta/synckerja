import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type CarouselSlide } from "./canvaCarouselBrief.ts";
import {
  collectPageTextsFromDesign,
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
