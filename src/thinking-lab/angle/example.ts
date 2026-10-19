const LEAD =
  /^(?:misalnya|contohnya|contoh|seperti ketika|seperti|for example|for instance|e\.g\.|eg)\b[\s,:.\-]*/i;

function wordsOf(raw: string): string[] {
  return raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function comparable(raw: string): string {
  return raw
    .toLocaleLowerCase()
    .replace(/[.,;:!?“”"'`()[\]—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One pictured situation. A leading label is removed because the card already names it. */
export function normalizeAngleExample(raw: string): string {
  const words = wordsOf(raw.replace(LEAD, "")).slice(0, 40);
  if (words.length < 1) return "";
  const sentence = words.join(" ").replace(/[.。]+$/g, "");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function angleExampleProblem(example: string, statement: string): string {
  const named = normalizeAngleExample(example);
  if (!named) return "This Angle has no example.";
  if (wordsOf(named).length < 6) return "The example is too thin to picture.";
  if (comparable(named) === comparable(statement)) return "The example only repeats the explanation.";
  return "";
}
