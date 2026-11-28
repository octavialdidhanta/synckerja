/**
 * Competitive advantage points of a Product Knowledge row, and their link to the Daftar Klaim.
 * PK keeps the positioning; each point is backed by claims. A link is a product_claim_uses row
 * (module product_knowledge, ref_id "<pk id>:<point hash>", label = the point text), so it also
 * shows as Jejak pemakaian. Editing a point's text drops its link: the new text must be backed again.
 */

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function pointsFromHtml(html: string): string[] {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => plain(m[1]));
  if (items.length) return items;
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => plain(m[1]));
  if (paragraphs.length) return paragraphs;
  return plain(html.replace(/\n+/g, "<br>"))
    ? html
        .split(/\n+/)
        .map(plain)
        .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    : [];
}

/** One string per competitive advantage point, whatever shape the row stores (HTML string or array). */
export function parseAdvantagePoints(raw: unknown): string[] {
  const out: string[] = [];
  const add = (text: string) => {
    const t = text.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  if (typeof raw === "string") pointsFromHtml(raw).forEach(add);
  else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") pointsFromHtml(item).forEach(add);
      else if (item && typeof item === "object") {
        const v = (item as Record<string, unknown>).text ?? (item as Record<string, unknown>).point;
        if (typeof v === "string") pointsFromHtml(v).forEach(add);
      }
    }
  }
  return out;
}

/** Stable short hash (FNV-1a 32-bit) of a point's text. */
export function pointHash(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of text.trim().toLowerCase()) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function pointRef(productKnowledgeId: string, text: string): string {
  return `${productKnowledgeId}:${pointHash(text)}`;
}

export const PK_USE_MODULE = "product_knowledge";
