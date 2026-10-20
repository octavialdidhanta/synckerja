import type { ProductBeliefSourceRow } from "@/thinking-lab/master-thought/productBrief";

export type ProductReasonKind = "advantage" | "solution" | "feature";

export type ProductReasonItem = {
  id: string;
  kind: ProductReasonKind;
  feature: string;
  text: string;
};

export type ProductReasonPool = {
  serviceName: string;
  items: ProductReasonItem[];
};

const KINDS = new Set<ProductReasonKind>(["advantage", "solution", "feature"]);

const STOP_WORDS = new Set([
  "yang",
  "dengan",
  "untuk",
  "dari",
  "pada",
  "adalah",
  "ini",
  "itu",
  "dan",
  "atau",
  "the",
  "and",
  "with",
  "that",
  "this",
  "from",
  "karena",
  "because",
  "sehingga",
  "sangat",
  "ada",
  "tidak",
  "harus",
  "saat",
  "oleh",
]);

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function featureText(row: ProductBeliefSourceRow): string {
  const name = clean(row.feature);
  const description = clean(row.featureDescription);
  if (name && description) return `${name}. ${description}`;
  return name || description;
}

export function buildProductReasonPool(serviceName: string, rows: ProductBeliefSourceRow[]): ProductReasonPool {
  const items: ProductReasonItem[] = [];
  const push = (kind: ProductReasonKind, feature: string, text: string) => {
    const body = clean(text);
    if (!body) return;
    items.push({
      id: `r${items.length + 1}`,
      kind,
      feature: clean(feature),
      text: body,
    });
  };
  for (const row of rows) {
    const feature = clean(row.feature) || clean(row.featureDescription);
    push("feature", feature, featureText(row));
    push("solution", feature, row.solution);
    push("advantage", feature, row.competitiveAdvantage);
  }
  return { serviceName: clean(serviceName), items };
}

export function readProductReasonPool(value: unknown): ProductReasonPool | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { serviceName?: unknown; items?: unknown };
  const serviceName = typeof record.serviceName === "string" ? clean(record.serviceName) : "";
  if (!serviceName) return null;
  const items = Array.isArray(record.items)
    ? record.items.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as { id?: unknown; kind?: unknown; feature?: unknown; text?: unknown };
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const kind = typeof item.kind === "string" ? item.kind : "";
        const text = typeof item.text === "string" ? clean(item.text) : "";
        if (!id || !text || !KINDS.has(kind as ProductReasonKind)) return [];
        return [
          {
            id,
            kind: kind as ProductReasonKind,
            feature: typeof item.feature === "string" ? clean(item.feature) : "",
            text,
          },
        ];
      })
    : [];
  return { serviceName, items };
}

export function productReasonLines(pool: ProductReasonPool): string {
  if (pool.items.length === 0) return "(none)";
  return pool.items
    .map((item) => {
      const feature = item.feature ? ` (${item.feature})` : "";
      return `${item.id} ${item.kind}${feature}: ${item.text}`;
    })
    .join("\n");
}

function contentTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

/** The clause keeps concrete words from the cited reason, not only its id. */
export function statementUsesReason(statement: string, reasonText: string): boolean {
  const reasonTokens = [...new Set(contentTokens(reasonText))];
  if (reasonTokens.length === 0) return false;
  const statementTokens = new Set(contentTokens(statement));
  const shared = reasonTokens.filter((token) => statementTokens.has(token));
  if (reasonTokens.length === 1) return shared.length === 1;
  return shared.length >= 2 || shared.some((token) => token.length >= 8);
}
