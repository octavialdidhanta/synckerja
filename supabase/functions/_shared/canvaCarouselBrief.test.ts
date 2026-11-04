import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCanvaCarouselBrief, carouselSlidesFromBrief } from "./canvaCarouselBrief.ts";

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

Deno.test("buildCanvaCarouselBrief keeps the 4:5 ratio and every slide", () => {
  const brief = buildCanvaCarouselBrief({
    title: "Langkah Cepat",
    caption: "Mulai hari ini #kemandirian",
    slides: carouselSlidesFromBrief(storyboard),
  });
  assertEquals(brief.includes("4:5"), true);
  assertEquals(brief.includes("Slide 1:"), true);
  assertEquals(brief.includes("#kemandirian"), true);
});
