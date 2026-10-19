const LEAD =
  /^(?:kita|we|i)\s+(?:menampilkan|mengundang|menciptakan|menunjukkan|membuat|menceritakan|menggambarkan|mengisahkan|menyajikan|membangun|membandingkan|mensimulasikan|mengamati|mengilustrasikan|memperlihatkan|menguji|show|invite|create|make|compare|simulate)\s+/i;
const SCENE = /^(?:sebuah\s+)?(?:skenario|simulasi|cerita|kisah|situasi|scenario|simulation|situation)\s+(?:di\s+mana|where)\s+/i;
const WATCH = /^(?:lalu\s+)?(?:kita\s+)?(?:mengamati|melihat)\s+bagaimana\s+/i;
const WHEN = /^(?:ketika|saat|when)\s+[^,]+,\s*/i;
const GENERIC = /^(?:individu|orang|seseorang|person|people|someone|individual)s?$/i;
const SKIP =
  /^(?:yang|hanya|dapat|adanya|secara|seorang|sebuah|bagaimana|jika|ada|oleh|para|telah|kini|sudah|kita)$/i;
const TRAILING = /^(?:yang|dan|atau|untuk|di|ke|dari|dengan|tanpa|the|a|an|of|and|or|to|for|yang|hanya|dapat|adanya|secara|seorang|bagaimana|jika|ada|oleh)$/i;

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

function specificHead(raw: string): string {
  const head = raw.replace(/^(?:seorang|sebuah|beberapa|para)\s+/i, "").trim();
  const words = wordsOf(head);
  if (words.length === 0) return "";
  if (words.every((word) => GENERIC.test(word))) return "";
  return head;
}

const COMPARE_SKIP =
  /^(?:waktu|upaya|dihabiskan|dibutuhkan|setiap|hari|sebagian|besar|tersebut|menangani|jika|ada|satu|dan|atau|antar|rutin)$/i;

const GLUE = /^(?:untuk|di|ke|dari|dengan|dan|atau|yang|tanpa)$/i;

function sideWords(raw: string, max: number): string[] {
  const kept: string[] = [];
  for (const word of wordsOf(raw)) {
    if (SKIP.test(word) || COMPARE_SKIP.test(word) || GLUE.test(word)) continue;
    kept.push(word);
    if (kept.length === max) break;
  }
  return kept;
}

function keptWords(raw: string, max = 6): string[] {
  const kept: string[] = [];
  for (const word of wordsOf(raw)) {
    if (SKIP.test(word)) continue;
    kept.push(word);
    if (kept.length === max) break;
  }
  while (kept.length > 1 && TRAILING.test(kept[kept.length - 1] ?? "")) kept.pop();
  return kept;
}

function comparisonSummary(original: string): string | null {
  if (!/\b(?:membandingkan|compare)\b/i.test(original)) return null;
  const match = original.match(/\b(?:membandingkan|compare)\s+([\s\S]+?)\s+\bdengan\b\s+([\s\S]+)/i);
  if (!match) return null;
  const left = sideWords(match[1] ?? "", 2);
  const right = sideWords(match[2] ?? "", 2);
  if (left.length === 0 || right.length === 0) return null;
  return capitalize([...left, "dengan", ...right].join(" "));
}

/** Short map label for an Idea. The inspector keeps the full statement. */
export function ideaNodeSummary(statement: string): string {
  const original = statement.trim().replace(/[.。]+$/g, "");
  if (!original) return "";
  if (wordsOf(original).length <= 6) {
    const kept = wordsOf(original);
    while (kept.length > 1 && TRAILING.test(kept[kept.length - 1] ?? "")) kept.pop();
    return capitalize(kept.join(" "));
  }

  const compared = comparisonSummary(original);
  if (compared) return compared;

  let text = original;
  const turn = text.split(/\s+(?:namun|tetapi|tapi|however|but)\s+/i);
  if (turn.length > 1 && wordsOf(turn[turn.length - 1] ?? "").length >= 4) text = turn[turn.length - 1] ?? text;
  text = text.replace(LEAD, "").replace(SCENE, "").replace(WHEN, "").replace(WATCH, "");
  const shock = text.match(/\b(?:tiba-tiba|suddenly)\s+(.+)/i);
  if (shock) {
    const who = specificHead((text.split(/\s+yang\s+/i)[0] ?? "").split(",")[0] ?? "");
    const event = keptWords((shock[1] ?? "").split(",")[0] ?? "", 3);
    const label = capitalize(keptWords([who, ...event].join(" ")).join(" "));
    if (label) return label;
  }
  text = text.split(/\s+(?=bukan\b|melainkan\b|menjelaskan\b)/i)[0] ?? text;
  const purposeMatch = text.match(/\buntuk\s+(.+)$/i);
  const purpose = purposeMatch?.[1]?.split(/\s*(?:,|;|:|\batau\b|\byang\b|\btentang\b|\bkarena\b)/i)[0]?.trim() ?? "";
  const beforePurpose = (purposeMatch ? text.slice(0, purposeMatch.index) : text).trim();
  const firstClause = beforePurpose.split(/\s*,\s*/)[0]?.trim() ?? "";
  const [headRaw, qualifierRaw] = firstClause.split(/\s+yang\s+/i);
  const head = specificHead(headRaw ?? "");
  const qualifier = (qualifierRaw ?? "").split(/\s+(?=dan\b|atau\b)/i)[0]?.replace(/^(?:telah|kini|sudah|setelah)\s+/i, "").trim() ?? "";

  const parts: string[] = [];
  if (head) parts.push(head);
  else if (qualifier) parts.push(qualifier);
  if (purpose) parts.push(purpose);
  else if (head && qualifier) parts.push(qualifier);
  if (parts.length === 0) parts.push(firstClause || text);

  const summary = capitalize(keptWords(parts.join(" ")).join(" "));
  return summary || capitalize(keptWords(original).join(" "));
}

/** Uses a stored short name when it already says the mechanism. */
export function ideaLabel(statement: string, subject?: string | null): string {
  const named = (subject ?? "").trim();
  if (!named) return ideaNodeSummary(statement);
  return ideaNodeSummary(named);
}
