const LEADING =
  /^(?:me\w+|di\w+|ter\w+|ber\w+|meng\w+|mem\w+|men\w+|meny\w+|yang|untuk|dengan|agar|supaya|to|for|the|a|an)\b/i;
const TRAILING = /^(?:yang|dan|atau|untuk|di|ke|dari|dengan|the|a|an|of|and|or|to|for)$/i;

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
  const head = text.split(/\s*,\s*(?=namun\b|tetapi\b|tapi\b|however\b|but\b)/i)[0] ?? text;
  const words = wordsOf(head);
  while (words.length > 1 && LEADING.test(words[0] ?? "")) words.shift();
  const kept = words.slice(0, 4);
  while (kept.length > 1 && TRAILING.test(kept[kept.length - 1] ?? "")) kept.pop();
  const subject = capitalize(kept.join(" "));
  if (subject) return subject;
  return capitalize(wordsOf(statement).slice(0, 4).join(" "));
}
