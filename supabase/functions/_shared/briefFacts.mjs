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

/** Non-empty website + default contact from the catalog brand lockup. */
export function lockupContactFacts(input) {
  const facts = [];
  const website = String(input?.websiteUrl ?? "").replace(/\s+/g, "").trim().slice(0, 200);
  const contact = String(input?.defaultContact ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (website) facts.push(website);
  if (contact) facts.push(contact);
  return facts;
}

function contactFactKey(fact) {
  const clean = String(fact ?? "").replace(/\s+/g, " ").trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length >= clean.replace(/[\s+().-]/g, "").length * 0.7) {
    return `tel:${digits.replace(/^0/, "62").replace(/^62/, "62")}`;
  }
  return clean.toLowerCase();
}

function contactFactClip(fact) {
  const clean = String(fact ?? "").replace(/\s+/g, " ").trim();
  if (/^https?:\/\//i.test(clean)) return clean.slice(0, 200);
  return clean.slice(0, 80);
}

/** Lockup contacts first, then required-note facts; dedupe; cap at 5. */
export function mergeContactFacts(lockup, requiredNote, limit = 5) {
  const out = [];
  const seen = new Set();
  const add = (fact) => {
    const clean = contactFactClip(fact);
    if (!clean) return;
    const key = contactFactKey(clean);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };
  for (const fact of lockup ?? []) {
    if (out.length >= limit) break;
    add(fact);
  }
  for (const fact of briefFacts(requiredNote)) {
    if (out.length >= limit) break;
    add(fact);
  }
  return out;
}
