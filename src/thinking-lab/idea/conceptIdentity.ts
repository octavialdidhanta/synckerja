const PLATFORMS = ["instagram", "tiktok", "youtube", "carousel", "reels", "shorts", "video", "article"];

function collapse(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function bodyWithoutTitle(statement: string): string {
  const lines = statement
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return collapse(statement);
  const title = lines[0].replace(/:$/, "");
  if (title.length > 80 || title.includes(".")) return collapse(statement);
  return collapse(lines.slice(1).join(" "));
}

function withoutPlatformWords(value: string): string {
  return value
    .split(" ")
    .filter((word) => !PLATFORMS.includes(word.replace(/[^a-z]/g, "")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ideaConceptBody(statement: string): string {
  return withoutPlatformWords(bodyWithoutTitle(statement));
}

export function sameIdeaConcept(left: string, right: string): boolean {
  const a = ideaConceptBody(left);
  const b = ideaConceptBody(right);
  return a.length > 0 && a === b;
}
