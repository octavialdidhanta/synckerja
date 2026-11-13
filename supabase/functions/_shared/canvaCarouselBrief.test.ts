import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FOOD_PHOTO_RULE, PERSON_PHOTO_RULE, buildCanvaCarouselBrief, carouselPalette, carouselReferencePosition, carouselSlidesFromBrief, layoutOnlyDescription } from "./canvaCarouselBrief.ts";

const storyboard = [
  "| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |",
  "| --- | --- | --- | --- | --- | --- |",
  "| Slide 1 |  |  | Ibu bertanya di meja makan |  |  |",
  "| Slide 2 |  |  | Anak menjawab dengan tenang |  |  |",
].join("\n");

Deno.test("carouselSlidesFromBrief reads Scene Visual and skips the empty image column", () => {
  const slides = carouselSlidesFromBrief(storyboard);
  assertEquals(slides.length, 2);
  assertEquals(slides[0].scene, "Ibu bertanya di meja makan");
  assertEquals(slides[1].label, "Slide 2");
});

Deno.test("carouselSlidesFromBrief rejects a storyboard without scene text", () => {
  const empty = [
    "| Timing | Visual |",
    "| --- | --- |",
    "| Slide 1 |  |",
  ].join("\n");
  assertEquals(carouselSlidesFromBrief(empty), []);
});

Deno.test("buildCanvaCarouselBrief reserves the last page center for one library product photo", () => {
  const brief = buildCanvaCarouselBrief({
    title: "Menu",
    caption: "",
    slides: carouselSlidesFromBrief(storyboard),
    productPhotos: ["Ayam Kampung (Paha / Sayap / Dada)"],
  });
  assertEquals(brief.includes("Ayam Kampung (Paha / Sayap / Dada)"), true);
  assertEquals(brief.includes("goes in the center of the last page only"), true);
  assertEquals(brief.includes("Keep the center empty for the real product photo."), true);
  assertEquals(brief.includes("Leave the center of every page empty"), false);
  assertEquals(brief.includes("Setting only, no food drawn: Anak menjawab dengan tenang"), true);
  assertEquals(brief.includes("Real menu shown: Ayam Kampung (Paha / Sayap / Dada)."), true);
});

Deno.test("buildCanvaCarouselBrief keeps the 4:5 ratio and every slide", () => {
  const brief = buildCanvaCarouselBrief({
    title: "Langkah Cepat",
    caption: "Mulai hari ini #kemandirian",
    slides: carouselSlidesFromBrief(storyboard),
  });
  assertEquals(brief.includes("4:5"), true);
  assertEquals(brief.includes("Page 1"), true);
  assertEquals(brief.includes("Real person photo. Scene: Ibu bertanya di meja makan"), true);
  assertEquals(brief.includes("#kemandirian"), true);
});

Deno.test("carouselSlidesFromBrief keeps copy, hook, and other elements", () => {
  const filled = [
    "| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Ibu mengira sibuk adalah sayang. | Ibu memandang kalender | Hook headline: Sibuk bukan sayang. Visual hook: Kalender menutup wajah. |  |",
    "| Slide 2 |  | Anak butuh ibu yang hadir. | Anak menunjuk ke luar jendela | Kontras ekspresi ibu dan anak. |  |",
  ].join("\n");
  const slides = carouselSlidesFromBrief(filled);
  assertEquals(slides[0].copy, "Ibu mengira sibuk adalah sayang.");
  assertEquals(slides[0].elements.includes("Hook headline:"), true);
  assertEquals(slides[0].elements.includes("Visual hook:"), true);
  const brief = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
  });
  assertEquals(brief.includes("Write only: Ibu mengira sibuk adalah sayang. | Sibuk bukan sayang"), true);
  assertEquals(brief.includes("Real person photo. Scene: Ibu memandang kalender. Kalender menutup wajah"), true);
  assertEquals(brief.includes("Write only: Anak butuh ibu yang hadir. | Kontras ekspresi ibu dan anak"), true);
  assertEquals(brief.includes("Visual hook:"), false);
  const locked = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
    styleLock: "Bold poster, red and yellow blocks, heavy sans type. Headline sits at the top.",
    palette: { primary: "#112233", secondary: "#445566", accent: "#778899" },
    logo: "required",
  });
  assertEquals(locked.includes("Layout and type for every page, copied from the reference: Headline sits at the top."), true);
  assertEquals(locked.includes("\nLayout and type: "), false);
  assertEquals(locked.includes("named typeface"), true);
  assertEquals(locked.includes("red and yellow"), false);
  assertEquals(locked.includes("primary #112233"), true);
  assertEquals(locked.includes("secondary #445566"), true);
  assertEquals(locked.includes("accent #778899"), true);
  assertEquals(locked.includes("text color"), false);
  assertEquals(locked.includes("Leave the top center of every page empty."), true);
  assertEquals(locked.includes("Do not draw a logo"), false);
  assertEquals(locked.includes("Write only the listed words"), true);
  assertEquals(locked.includes("Write only: Ibu mengira sibuk adalah sayang."), true);
  const plain = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
    logo: "none",
  });
  assertEquals(plain.includes("Leave the top center"), false);
  assertEquals(plain.includes("Choose readable colors"), true);
  assertEquals(carouselPalette("Warna: primer #aabbcc, sekunder #112233, aksen #445566"), {
    primary: "#aabbcc",
    secondary: "#112233",
    accent: "#445566",
  });
  assertEquals(carouselPalette("tanpa warna"), null);
  assertEquals(
    layoutOnlyDescription("Photo on the left. Red blocks fill the page. The logo sits in a circle. Headline sits at the top."),
    "Photo on the left. Headline sits at the top.",
  );
});

Deno.test("carouselSlidesFromBrief reads Teks when the board has no voice over", () => {
  const board = [
    "| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Ibu memegang buku rencana | Sibuk merencanakan masa depan anak. | Hook headline: Visi. Visual hook: Buku. Referensi 1 |  |",
  ].join("\n");
  const slides = carouselSlidesFromBrief(board);
  assertEquals(slides[0].scene, "Ibu memegang buku rencana");
  assertEquals(slides[0].copy, "Sibuk merencanakan masa depan anak.");
  assertEquals(slides[0].elements.includes("Referensi 1"), true);
});

Deno.test("carouselReferencePosition keeps one agreed slot", () => {
  const withReference = [
    "| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Ibu mengira sibuk adalah sayang. | Ibu memandang kalender | Hook headline: Sibuk bukan sayang. Visual hook: Kalender menutup wajah. Referensi 2 |  |",
    "| Slide 2 |  | Anak butuh ibu yang hadir. | Anak menunjuk ke luar jendela | Kontras ekspresi ibu dan anak. Referensi 2 |  |",
  ].join("\n");
  const slides = carouselSlidesFromBrief(withReference);
  assertEquals(carouselReferencePosition(slides), 2);
  const brief = buildCanvaCarouselBrief({ title: "Hadir", caption: "Lihat lagi #keluarga", slides });
  assertEquals(brief.includes("Write only: Anak butuh ibu yang hadir. | Kontras ekspresi ibu dan anak"), true);
  assertEquals(brief.includes("Referensi 2"), false);
  const directions = carouselSlidesFromBrief([
    "| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Pertanyaan ibu | Membangun masa depan anak. | Hook headline: Visi hari ini. Visual hook: Ibu dan anak di taman. Referensi 1 |  |",
    "| Slide 2 |  | Anak di meja belajar | Fokus pada rencana besar. | Ilustrasi anak bingung dengan tumpukan buku. Referensi 2 |  |",
    "| Slide 3 |  | Ibu berlutut | Tanyakan hal kecil hari ini. | Dialog bubble: Apa yang ingin kamu lakukan hari ini? Referensi 1 |  |",
    "| Slide 4 |  | Dapur | Masukkan keinginan kecil. | Gambar ibu dan anak membuat kue. Referensi 2 |  |",
    "| Slide 5 |  | Anak tersenyum | Ajarkan keseimbangan. | Teks: Keseimbangan & Kehadiran. Referensi 1 |  |",
  ].join("\n"));
  const directed = buildCanvaCarouselBrief({ title: "Hadir", caption: "Lihat", slides: directions });
  assertEquals(directed.includes("Ilustrasi anak bingung"), false);
  assertEquals(directed.includes("Gambar ibu dan anak"), false);
  assertEquals(/Write only:[^\n]*Apa yang ingin kamu lakukan hari ini/.test(directed), false);
  assertEquals(directed.includes("Write only: Ajarkan keseimbangan. | Keseimbangan & Kehadiran"), true);
  assertEquals(directed.includes("Real person photo. Scene: Anak di meja belajar. anak bingung dengan tumpukan buku"), true);
  const mixed = slides.map((slide, index) => (
    index === 1 ? { ...slide, elements: slide.elements.replace("Referensi 2", "Referensi 4") } : slide
  ));
  assertEquals(carouselReferencePosition(mixed), null);
  assertEquals(carouselReferencePosition(carouselSlidesFromBrief(storyboard)), null);
});

Deno.test("buildCanvaCarouselBrief writes the required note and photographs a person", () => {
  const slides = carouselSlidesFromBrief([
    "| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Sate kambing di atas piring | Daging muda lebih empuk. | Hook headline: Empuk. |  |",
    "| Slide 2 |  | Penjual sate tersenyum | Hubungi jam buka. | Ajakan singkat di bawah. |  |",
  ].join("\n"));
  const brief = buildCanvaCarouselBrief({
    title: "Empuk",
    caption: "Datang hari ini",
    slides,
    requiredNote: "Cantumkan nomor telepon 081234567890 di slide terakhir.",
    forbiddenNote: "harga promo",
  });
  assertEquals(brief.includes("Write exactly this on the last page: 081234567890"), true);
  assertEquals(brief.includes("Cantumkan nomor telepon"), false);
  assertEquals(brief.includes("Do not write any of this: harga promo"), true);
  assertEquals(brief.includes("Write only: Hubungi jam buka. | Ajakan singkat di bawah | 081234567890"), true);
  assertEquals(brief.includes("Real food photo. Scene: Sate kambing di atas piring"), true);
  assertEquals(brief.split(FOOD_PHOTO_RULE).length - 1, 1);
  assertEquals(brief.includes("Draw: Sate kambing di atas piring"), false);
  assertEquals(brief.includes(PERSON_PHOTO_RULE), true);
  assertEquals(brief.includes("Scene: Penjual sate tersenyum"), true);
  assertEquals(brief.includes("Do not draw a substitute picture of the food."), false);
});

Deno.test("buildCanvaCarouselBrief shortens scenes so the last page always fits", () => {
  const long = "Pelanggan tersenyum sambil memegang tusuk sate kambing di warung yang ramai dengan lampu hangat dan asap tipis dari panggangan, ".repeat(4);
  const rows = Array.from({ length: 8 }, (_, index) =>
    `| Slide ${index + 1} |  | ${long} | Kalimat slide ${index + 1} yang cukup panjang untuk dibaca. | Ajakan singkat. |  |`);
  const slides = carouselSlidesFromBrief([
    "| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n"));
  const brief = buildCanvaCarouselBrief({
    title: "Panjang",
    caption: "Caption #tes",
    slides,
    productPhotos: ["Sate Kambing Full Daging"],
    requiredNote: "Cantumkan nomor telepon 085923305709 di slide terakhir.",
  });
  assertEquals(brief.length <= 3500, true);
  assertEquals(brief.includes("Page 8"), true);
  assertEquals(brief.includes("Keep the center empty for the real product photo."), true);
  assertEquals(brief.includes("Write only the listed words."), true);
  assertEquals(brief.split(FOOD_PHOTO_RULE).length - 1, 1);
  assertEquals(brief.split(PERSON_PHOTO_RULE).length - 1, 1);
});

Deno.test("buildCanvaCarouselBrief names the menus without reserving a photo slot", () => {
  const brief = buildCanvaCarouselBrief({
    title: "Menu",
    caption: "",
    slides: carouselSlidesFromBrief(storyboard),
    menus: ["Sate Kambing Full Daging", "Sate Kambing Campur Lemak"],
  });
  assertEquals(brief.includes("Real menu shown: Sate Kambing Full Daging; Sate Kambing Campur Lemak."), true);
  assertEquals(brief.includes(FOOD_PHOTO_RULE), true);
  assertEquals(brief.includes("Keep the center empty"), false);
  assertEquals(brief.includes("goes in the center of the last page"), false);
  assertEquals(brief.includes("Setting only, no food drawn"), false);
});

Deno.test("buildCanvaCarouselBrief writes one shared reference layout once, mixed slots per page", () => {
  const page = (elements: string) => ({ label: "", scene: "Meja makan", copy: "Halo", elements, tagging: "" });
  const styleLock = "Referensi 1: Photo fills the lower half. Referensi 2: Headline sits left in two lines.";
  const same = buildCanvaCarouselBrief({
    title: "T",
    caption: "",
    slides: [page("Hook headline: A. Referensi 2"), page("Point: B. Referensi 2")],
    styleLock,
  });
  assertEquals(same.split("Headline sits left in two lines.").length - 1, 1);
  assertEquals(same.includes("Layout and type for every page, copied from the reference: Headline sits left"), true);
  assertEquals(same.includes("Photo fills the lower half"), false);
  const mixed = buildCanvaCarouselBrief({
    title: "T",
    caption: "",
    slides: [page("Hook headline: A. Referensi 1"), page("Point: B. Referensi 2")],
    styleLock,
  });
  assertEquals(mixed.includes("Layout and type: Photo fills the lower half."), true);
  assertEquals(mixed.includes("Layout and type: Headline sits left in two lines."), true);
  assertEquals(mixed.includes("for every page"), false);
});
