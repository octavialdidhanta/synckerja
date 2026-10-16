const FRAMING =
  /^(?:kita|we|i)\s+(?:menampilkan|mengundang|menciptakan|menunjukkan|membuat|menceritakan|menggambarkan|mengisahkan|menyajikan|membangun|show|invite|create|make)\s+/i;
const SCENE = /^(?:sebuah\s+)?(?:skenario|simulasi|cerita|kisah|scenario|simulation)\s+(?:di\s+mana|where)\s+/i;
const GENERIC = /^(?:individu|orang|seseorang|person|people|someone|individual)s?$/i;
const TRAILING = /^(?:yang|dan|atau|untuk|di|ke|dari|dengan|the|a|an|of|and|or|to|for|yang)$/i;

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
  const head = raw
    .replace(/^(?:seorang|sebuah|beberapa|para)\s+/i, "")
    .trim();
  const words = wordsOf(head);
  if (words.length === 0) return "";
  if (words.every((word) => GENERIC.test(word))) return "";
  return head;
}

/** Short map label for an Idea. The inspector keeps the full statement. */
export function ideaNodeSummary(statement: string): string {
  const original = statement.trim().replace(/[.。]+$/g, "");
  if (!original) return "";
  if (wordsOf(original).length <= 5) return capitalize(original);

  let text = original.replace(FRAMING, "").replace(SCENE, "");
  text = text.split(/\s+(?=bukan\b|melainkan\b|namun\b|tetapi\b|tapi\b|however\b|but\b|menjelaskan\b)/i)[0] ?? text;
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

  const kept = wordsOf(parts.join(" ")).slice(0, 6);
  while (kept.length > 1 && TRAILING.test(kept[kept.length - 1] ?? "")) kept.pop();
  const summary = capitalize(kept.join(" "));
  return summary || capitalize(wordsOf(original).slice(0, 6).join(" "));
}
