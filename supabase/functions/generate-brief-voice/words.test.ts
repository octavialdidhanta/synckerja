import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { alignmentToWords, base64ToBytes } from "./words.ts";

function align(text: string, step = 0.1) {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * step),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * step),
  };
}

Deno.test("words with punctuation kept, audio tags dropped", () => {
  const w = alignmentToWords(align("[conversational, playful] Satu. Angkat tulangnya."));
  assertEquals(w.map((x) => x.text), ["Satu.", "Angkat", "tulangnya."]);
  assertEquals(w[0], { text: "Satu.", start: 2.6, end: 3.1 });
});

Deno.test("empty or missing alignment gives no words", () => {
  assertEquals(alignmentToWords(null), []);
  assertEquals(alignmentToWords({ characters: [" ", "-", " "] }), []);
});

Deno.test("base64 decode", () => {
  assertEquals([...base64ToBytes("SUQz")], [73, 68, 51]);
});
