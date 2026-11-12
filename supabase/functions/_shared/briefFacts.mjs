function compact(value) {
  return String(value ?? "").toLowerCase().replace(/[\s.]/g, "");
}

export function briefFacts(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const found = [];
  const seen = new Set();
  const add = (fact) => {
    const clean = String(fact ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    found.push(clean);
  };
  const phones = text.matchAll(/(?<!\d)(?:\+62[\s.-]*|62[\s.-]*|0)8(?:[\s.-]*\d){8,13}(?!\d)/g);
  for (const match of phones) add(match[0].replace(/\D/g, ""));
  const prices = text.matchAll(/\bRp\.?\s*\d[\d.]*(?:,\d+)?/gi);
  for (const match of prices) add(match[0].replace(/\s+/g, ""));
  const emails = text.matchAll(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi);
  for (const match of emails) add(match[0]);
  const links = text.matchAll(/\bhttps?:\/\/\S+/gi);
  for (const match of links) add(match[0].replace(/[),.]+$/, ""));
  return found.slice(0, 5);
}

export function textHasFact(text, fact) {
  const hay = String(text ?? "");
  const needle = String(fact ?? "").trim();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length === needle.length) return hay.replace(/\D/g, "").includes(digits);
  if (/^rp/i.test(needle)) return compact(hay).includes(compact(needle));
  return hay.toLowerCase().includes(needle.toLowerCase());
}
