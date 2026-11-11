import assert from "node:assert/strict";
import test from "node:test";
import { buildCanvaCarouselBrief, carouselPalette, layoutOnlyDescription } from "../../supabase/functions/_shared/canvaCarouselBrief.ts";

const slides = [
  {
    label: "Slide 1",
    scene: "Ibu memegang buku",
    copy: "Sibuk merencanakan.",
    elements: "Hook headline: Visi. Visual hook: Buku. Referensi 1",
    tagging: "",
  },
  {
    label: "Slide 2",
    scene: "Anak menunjuk jendela",
    copy: "Anak butuh kehadiran.",
    elements: "Kontras ekspresi. Referensi 1",
    tagging: "",
  },
];

test("layout referensi membuang kalimat warna", () => {
  assert.equal(
    layoutOnlyDescription("Photo on the left. Red blocks fill the page. Headline sits at the top."),
    "Photo on the left. Headline sits at the top.",
  );
});

test("brief canva memisahkan layout, hex, dan logo", () => {
  const locked = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
    styleLock: "Bold poster, red and yellow blocks. Headline sits at the top.",
    palette: { primary: "#112233", secondary: "#445566", accent: "#778899" },
    logo: "required",
  });
  assert.match(locked, /Visual system, mandatory: Headline sits at the top\./);
  assert.doesNotMatch(locked, /red and yellow/);
  assert.match(locked, /primary #112233/);
  assert.match(locked, /secondary #445566/);
  assert.match(locked, /accent #778899/);
  assert.doesNotMatch(locked, /text color/i);
  assert.match(locked, /Company logo is mandatory/);
  assert.match(locked, /must be the naskah/);
  assert.match(locked, /Teks di slide: Sibuk merencanakan\./);

  const plain = buildCanvaCarouselBrief({
    title: "Hadir",
    caption: "Lihat lagi #keluarga",
    slides,
    logo: "none",
  });
  assert.match(plain, /Do not add a logo/);
  assert.match(plain, /No brand palette is set/);
  assert.doesNotMatch(plain, /text color/i);
  assert.deepEqual(carouselPalette("Warna: primer #aabbcc, sekunder #112233, aksen #445566"), {
    primary: "#aabbcc",
    secondary: "#112233",
    accent: "#445566",
  });
  assert.equal(carouselPalette("tanpa warna"), null);
});
