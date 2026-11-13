import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FOOD_PHOTO_RULE, PERSON_PHOTO_RULE, PRODUCT_PHOTO_RULE, buildCanvaCarouselBrief, carouselPalette, carouselReferencePosition, carouselSlidesFromBrief, fitLayoutNote, layoutOnlyDescription, meatHint, meatRule, shortSlideText, slideTexts } from "./canvaCarouselBrief.ts";

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
  assertEquals(brief.includes("Headline (biggest text): Sibuk bukan sayang\nSmall text: Ibu mengira sibuk adalah sayang."), true);
  assertEquals(brief.includes("Real person photo. Scene: Ibu memandang kalender. Kalender menutup wajah"), true);
  assertEquals(brief.includes("Headline (biggest text): Kontras ekspresi ibu dan anak\nSmall text: Anak butuh ibu yang hadir."), true);
  assertEquals(brief.includes("Visual hook:"), false);
  const locked = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
    styleLock: "Bold poster, red and yellow blocks, heavy sans type. Headline sits at the top.",
    palette: { primary: "#112233", secondary: "#445566", accent: "#778899" },
    logo: "required",
  });
  assertEquals(locked.includes("Layout and type for every page, copied from the reference: Bold poster, blocks, heavy sans type. Headline sits at the top. Take only this structure"), true);
  assertEquals(locked.includes("\nLayout and type: "), false);
  assertEquals(locked.includes("Use the same frame, grid, and fonts on every page"), false);
  assertEquals(locked.includes("red and yellow"), false);
  assertEquals(locked.includes("primary #112233"), true);
  assertEquals(locked.includes("secondary #445566"), true);
  assertEquals(locked.includes("accent #778899"), true);
  assertEquals(locked.includes("text color"), false);
  assertEquals(locked.includes("Leave the top center of every page empty."), true);
  assertEquals(locked.includes("Do not draw a logo"), false);
  assertEquals(locked.includes("Write only the headline, small text, small labels, and contact box"), true);
  assertEquals(locked.includes("Small text: Ibu mengira sibuk adalah sayang."), true);
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
    "Photo on the left. Blocks fill the page. Headline sits at the top.",
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
  assertEquals(brief.includes("Headline (biggest text): Kontras ekspresi ibu dan anak"), true);
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
  assertEquals(/(Headline|Small text|Small labels)[^\n]*Apa yang ingin kamu lakukan hari ini/.test(directed), false);
  assertEquals(directed.includes("Headline (biggest text): Keseimbangan & Kehadiran\nSmall text: Ajarkan keseimbangan."), true);
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
  assertEquals(brief.includes("Write exactly this on the last page, in its contact box: 081234567890"), true);
  assertEquals(brief.includes("Cantumkan nomor telepon"), false);
  assertEquals(brief.includes("Do not write any of this: harga promo"), true);
  assertEquals(brief.includes("Headline (biggest text): Ajakan singkat di bawah\nSmall text: Hubungi jam buka.\nContact box, separate at the bottom of this page: 081234567890"), true);
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
  assertEquals(brief.length <= 5000, true);
  assertEquals(brief.includes("Page 8"), true);
  assertEquals(brief.includes("Keep the center empty for the real product photo."), true);
  assertEquals(brief.includes("Contact box, separate at the bottom of this page: 085923305709"), true);
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

Deno.test("layoutOnlyDescription keeps a sentence and removes only its color words", () => {
  assertEquals(
    layoutOnlyDescription("HEADLINE: Bold black sans, top-left, two lines.\nTEXT: small red price tag at bottom right."),
    "HEADLINE: Bold sans, top-left, two lines. TEXT: small price tag at bottom right.",
  );
});

Deno.test("fitLayoutNote drops decorations, then small text, and keeps photo, headline, type", () => {
  const note = "PHOTO: plate fills bottom 60%. HEADLINE: top-left two lines. TEXT: small tag bottom right. DECOR: thin frame around page. TYPE: Montserrat.";
  assertEquals(fitLayoutNote(note, 500), note);
  assertEquals(fitLayoutNote(note, 110), "PHOTO: plate fills bottom 60%. HEADLINE: top-left two lines. TEXT: small tag bottom right. TYPE: Montserrat.");
  assertEquals(fitLayoutNote(note, 90), "PHOTO: plate fills bottom 60%. HEADLINE: top-left two lines. TYPE: Montserrat.");
  assertEquals(fitLayoutNote(note, 0), "");
});

Deno.test("buildCanvaCarouselBrief gives a long shared layout the room the pages leave", () => {
  const page = (n: number) => ({ label: "", scene: `Meja makan ${n}`, copy: `Halo ${n}`, elements: "Point: A. Referensi 1", tagging: "" });
  const zone = (label: string) => `${label}: ${"detail ".repeat(60).trim()}.`;
  const longNote = ["PHOTO", "HEADLINE", "TEXT", "DECOR", "TYPE"].map(zone).join(" ");
  const brief = buildCanvaCarouselBrief({ title: "T", caption: "", slides: [page(1), page(2), page(3)], styleLock: `Referensi 1: ${longNote}` });
  assertEquals(brief.length <= 5000, true);
  assertEquals(brief.includes("PHOTO: detail"), true);
  assertEquals(brief.includes("HEADLINE: detail"), true);
  assertEquals(brief.includes("Page 3"), true);
  assertEquals(brief.includes("Headline (biggest text): A\nSmall text: Halo 3"), true);
});

Deno.test("slideTexts puts the headline first and trims the spoken line to about 12 words", () => {
  const texts = slideTexts({
    label: "Slide 2",
    scene: "Daging di talenan",
    copy: "Daging kambing muda itu warnanya cenderung merah muda cerah, terus seratnya juga halus dan nggak terlalu kelihatan.",
    elements: "Infografis: Perbandingan daging muda vs. tua. Headline: Muda vs Tua. Referensi 2",
    tagging: "",
  });
  assertEquals(texts.headline, "Muda vs Tua");
  assertEquals(texts.small.split(" ").length <= 12, true);
  assertEquals(texts.labels.some((label) => /Infografis/i.test(label)), false);
  assertEquals(shortSlideText("Jadi, kamu nggak perlu khawatir lagi dagingnya alot atau susah dikunyah."), "Jadi, kamu nggak perlu khawatir lagi dagingnya alot atau susah dikunyah.");
});

Deno.test("buildCanvaCarouselBrief moves drawing directions out of the slide text", () => {
  const slides = carouselSlidesFromBrief([
    "| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 |  | Daging kambing di talenan | Kenali dagingnya dulu. | Hook headline: Muda atau tua? Visual hook: Dua potong daging. |  |",
    "| Slide 2 |  | Daging muda close-up | Seratnya halus. | Teks: Serat Daging Halus. Panah menunjuk ke serat daging. |  |",
  ].join("\n"));
  const brief = buildCanvaCarouselBrief({ title: "Daging", caption: "#tes", slides });
  assertEquals(brief.includes("Headline (biggest text): Serat Daging Halus"), true);
  assertEquals(/(Headline|Small text|Small labels)[^\n]*Panah/.test(brief), false);
  assertEquals(brief.includes("Panah menunjuk ke serat daging"), true);
});

Deno.test("meatRule only speaks for meat and skewers", () => {
  assertEquals(meatRule("Ibu memegang buku di taman"), "");
  assertEquals(meatRule("Daging kambing mentah di talenan").includes("Goat meat (kambing) is deep red"), true);
  assertEquals(meatRule("Sate ayam di piring").includes("never minced"), true);
  assertEquals(meatRule("Sate ayam di piring").includes("Goat meat"), false);
  const charity = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "#keluarga",
    slides: carouselSlidesFromBrief(storyboard),
  });
  assertEquals(charity.includes("Meat rule"), false);
});

Deno.test("buildCanvaCarouselBrief falls back to the described reference when the slot is gone", () => {
  const page = (n: number) => ({ label: "", scene: `Meja makan ${n}`, copy: `Halo ${n}`, elements: "Point: A. Referensi 3", tagging: "" });
  const brief = buildCanvaCarouselBrief({ title: "T", caption: "", slides: [page(1), page(2)], styleLock: "Referensi 1: PHOTO: fills the lower half." });
  assertEquals(brief.includes("copied from the reference: PHOTO: fills the lower half."), true);
});

Deno.test("buildCanvaCarouselBrief keeps scenes at least 220 characters before trimming the layout", () => {
  const scene = "Pelanggan tersenyum memegang tusuk sate kambing di warung ramai, lampu hangat, asap tipis dari panggangan arang, meja kayu tua, piring kecil berisi bawang merah dan cabai, gelas es teh manis di samping piring.";
  const rows = Array.from({ length: 8 }, (_, index) => ({ label: "", scene, copy: `Kalimat ${index + 1} singkat.`, elements: "Headline: Judul. Referensi 1", tagging: "" }));
  const longNote = ["PHOTO", "HEADLINE", "TEXT", "DECOR", "TYPE"].map((label) => `${label}: ${"detail ".repeat(80).trim()}.`).join(" ");
  const brief = buildCanvaCarouselBrief({ title: "T", caption: "#tes", slides: rows, styleLock: `Referensi 1: ${longNote}` });
  assertEquals(brief.length <= 5000, true);
  assertEquals(brief.includes(scene.replace(/[.\s]+$/, "")), true);
  assertEquals(brief.includes("copied from the reference: PHOTO: detail"), true);
});

Deno.test("slideTexts turns an older Element note into a short title", () => {
  const photo = slideTexts({ label: "", scene: "Sate", copy: "Makanya kita cuma pakai daging muda.", elements: "Foto Sate Kambing Full Daging. Klaim: Daging kambing muda berkualitas tinggi. Referensi 2", tagging: "" });
  assertEquals(photo.headline, "Daging kambing muda berkualitas tinggi");
  const long = slideTexts({ label: "", scene: "Grafik", copy: "Nah, ini dia rahasianya!", elements: "Perbandingan keempukan daging kambing muda yang tinggi dan daging kambing tua yang rendah sekali. Referensi 2", tagging: "" });
  assertEquals(long.headline.split(" ").length <= 10, true);
  const labeled = slideTexts({ label: "", scene: "Sate", copy: "Teks.", elements: "Headline: Garansi Empuk. Point: Kambing muda", tagging: "" });
  assertEquals(labeled.headline, "Garansi Empuk");
  assertEquals(labeled.labels, ["Kambing muda"]);
});

Deno.test("meatHint sits next to sate and goat meat scenes only", () => {
  assertEquals(meatHint("Piring berisi sate kambing hangat", true), " (cubed goat meat chunks on bamboo skewers, not minced)");
  assertEquals(meatHint("Potongan daging kambing mentah di talenan", true), " (deep red goat meat with thin white fat, not pork-like)");
  assertEquals(meatHint("Ibu tersenyum di dapur", true), "");
  assertEquals(meatHint("Ibu tersenyum di dapur", false), "");
});

Deno.test("buildCanvaCarouselBrief gives a non-food catalog the product rule, not the food rule", () => {
  const page = (scene: string, elements: string) => ({ label: "", scene, copy: "Ngecas jadi cepet banget.", elements, tagging: "" });
  const slides = [
    page("Tangan mencolokkan charger ke HP di meja kerja, ada cangkir kopi", "Hook headline: HP lowbat terus?"),
    page("Close up kepala charger dan kabel USB-C", "Headline: Fast charging 20W"),
  ];
  const brief = buildCanvaCarouselBrief({ title: "Charger", caption: "", slides, menus: ["Charger 20W USB-C"] });
  assertEquals(brief.includes("Real products shown: Charger 20W USB-C. Draw these exact products."), true);
  assertEquals(brief.includes("dishes"), false);
  assertEquals(brief.includes(PRODUCT_PHOTO_RULE), true);
  assertEquals(brief.includes(FOOD_PHOTO_RULE), true, "the coffee cup on page 1 is still food in that scene");
  assertEquals(brief.includes("Meat rule"), false);
  const plain = buildCanvaCarouselBrief({
    title: "Charger",
    caption: "",
    slides: [page("Close up kepala charger", "Hook headline: HP lowbat terus?"), page("Kabel USB-C", "Headline: 20W")],
    menus: ["Charger 20W USB-C"],
    productPhotos: ["Charger 20W USB-C"],
  });
  assertEquals(plain.includes(FOOD_PHOTO_RULE), false);
  assertEquals(plain.includes("Photograph the product yourself"), true);
  assertEquals(plain.includes("Real food photo."), false);
});

Deno.test("buildCanvaCarouselBrief keeps the food rule for a food catalog", () => {
  const page = (scene: string) => ({ label: "", scene, copy: "Enak.", elements: "Headline: Mantap", tagging: "" });
  const brief = buildCanvaCarouselBrief({
    title: "Sate",
    caption: "",
    slides: [page("Pelanggan tersenyum di warung"), page("Meja kayu di warung")],
    menus: ["Sate Kambing Muda", "Es Jeruk"],
  });
  assertEquals(brief.includes("Real menu shown: Sate Kambing Muda; Es Jeruk. Draw these exact dishes."), true);
  assertEquals(brief.includes(FOOD_PHOTO_RULE), true);
  assertEquals(brief.includes(PRODUCT_PHOTO_RULE), false);
});
