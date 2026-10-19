const LEADING =
  /^(?:me\w+|di\w+|ter\w+|ber\w+|meng\w+|mem\w+|men\w+|meny\w+|yang|untuk|dengan|agar|supaya|to|for|the|a|an)\b/i;
const OPEN =
  /^(?:yang|dan|atau|untuk|di|ke|dari|dengan|pada|oleh|secara|tanpa|tak|tidak|bukan|bisa|dapat|mampu|akan|sedang|sudah|telah|sama|saja|agar|supaya|sebagai|tentang|ini|itu|juga|lebih|sangat|masih|hanya|the|a|an|of|and|or|to|for|with|that|not|can|be)$/i;
const JUDGMENT =
  /\s*(?:,\s*)?(?=namun\b|tetapi\b|tapi\b|padahal\b|however\b|but\b|sama\s+saja\b|berarti\b)/i;
const MAX_WORDS = 6;

function wordsOf(raw: string): string[] {
  return raw
    .replace(/[.。]+$/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function angleNodeSubject(statement: string, territory = ""): string {
  let text = statement.trim().replace(/[.。]+$/g, "");
  const parent = territory.trim();
  if (parent && text.toLowerCase().startsWith(parent.toLowerCase())) {
    text = text.slice(parent.length).replace(/^[,:\s]+/, "");
  }
  const head = text.split(JUDGMENT)[0] ?? text;
  const words = wordsOf(head);
  while (words.length > 1 && LEADING.test(words[0] ?? "")) words.shift();
  const kept = words.length <= MAX_WORDS ? [...words] : words.slice(0, 4);
  while (kept.length < words.length && kept.length < MAX_WORDS && OPEN.test(kept[kept.length - 1] ?? "")) {
    kept.push(words[kept.length] ?? "");
  }
  while (kept.length > 1 && OPEN.test(kept[kept.length - 1] ?? "")) kept.pop();
  const subject = capitalize(kept.join(" "));
  if (subject) return subject;
  return capitalize(wordsOf(statement).slice(0, 4).join(" "));
}

const SUBJECT_MAX = 6;
const SUBJECT_START =
  /^(?:secara|sering|yang|tidak|tak|bukan|untuk|dengan|agar|dari|pada|sebuah|suatu|the|a|an|often|usually)$/i;

export function angleSubjectWords(raw: string): string[] {
  return raw
    .replace(/[“”"'`]/g, "")
    .replace(/[.。]+$/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[.。,;:!?—–"'`]+|[.。,;:!?—–"'`]+$/g, ""))
    .filter(Boolean);
}

export function normalizeAngleSubject(raw: string): string {
  const words = angleSubjectWords(raw).slice(0, SUBJECT_MAX);
  if (words.length < 1) return "";
  return capitalize(words.join(" "));
}

function comparableSubject(raw: string): string {
  return angleSubjectWords(raw).join(" ").toLocaleLowerCase();
}

/** The subject uses the Territory's name instead of naming the observation. */
export function angleSubjectCopiesTerritory(subject: string, territory: string): boolean {
  const name = comparableSubject(subject);
  const parent = comparableSubject(territory);
  if (!name || !parent) return false;
  if (name === parent || name.includes(parent)) return true;
  const parentWords = new Set(angleSubjectWords(territory).map((word) => word.toLocaleLowerCase()));
  const content = angleSubjectWords(subject)
    .map((word) => word.toLocaleLowerCase())
    .filter((word) => !OPEN.test(word) && !LEADING.test(word) && !SUBJECT_START.test(word));
  return content.length > 0 && content.every((word) => parentWords.has(word));
}

/** A name of at most six words that can be read without the long sentence. */
export function angleSubjectIsGlanceable(subject: string): boolean {
  const words = angleSubjectWords(subject);
  if (words.length < 1 || words.length > SUBJECT_MAX) return false;
  if (SUBJECT_START.test(words[0] ?? "")) return false;
  if (OPEN.test(words[words.length - 1] ?? "")) return false;
  return true;
}

export function angleSubjectProblem(subject: string, territory: string): string {
  const named = subject.trim();
  if (!named) return "This Angle has no short subject.";
  if (angleSubjectCopiesTerritory(named, territory)) return "The subject repeats the Territory name.";
  if (!angleSubjectIsGlanceable(named)) return "The subject must be a short name that can be read on its own.";
  return "";
}

/** The name shown in the list. Empty until the subject passes the checklist filter. */
export function angleListSubject(subject: string, territory: string): string {
  const named = normalizeAngleSubject(subject);
  if (!named || angleSubjectProblem(named, territory)) return "";
  return named;
}
