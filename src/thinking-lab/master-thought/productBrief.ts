import { beliefsMatch } from "@/thinking-lab/master-thought/semantic";

export type ProductBeliefSourceRow = {
  category: string;
  subCategory: string;
  feature: string;
  featureDescription: string;
  solution: string;
  competitiveAdvantage: string;
  customerPersona: string;
  problem: string;
  impact: string;
  wants: string;
  needs: string;
  hiddenNeeds: string;
  falseBelief: string;
  falseBeliefImpact: string;
  whatMakesThemStop: string;
};

export type ProductBeliefDraft = {
  priorBelief: string;
  plantedBelief: string;
  audience: string;
};

const FIELD_LIMIT = 700;

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= FIELD_LIMIT) return text;
  return `${text.slice(0, FIELD_LIMIT).trim()}…`;
}

function line(label: string, value: string): string | null {
  const text = clip(value);
  return text ? `${label}: ${text}` : null;
}

export function buildProductBeliefPrompt(rows: ProductBeliefSourceRow[]): string {
  const blocks = rows.map((row, index) => {
    const fields = [
      line("Category", row.category),
      line("Sub Category", row.subCategory),
      line("Feature / Composition", row.feature),
      line("Feature / Composition description", row.featureDescription),
      line("Solution (for feature/composition)", row.solution),
      line("Competitive Advantage", row.competitiveAdvantage),
      line("Customer Persona", row.customerPersona),
      line("Problem", row.problem),
      line("Impact", row.impact),
      line("Wants", row.wants),
      line("Needs", row.needs),
      line("Hidden Needs", row.hiddenNeeds),
      line("False Belief", row.falseBelief),
      line("False Belief Impact", row.falseBeliefImpact),
      line("What Makes Them Stop", row.whatMakesThemStop),
    ].filter((entry): entry is string => Boolean(entry));
    return [`Feature ${index + 1}`, ...fields].join("\n");
  });
  return [
    "You help a content strategist choose one old belief, one new belief, and one target audience for a Master Thought.",
    "Read every column that is present on each selected feature. Do not skip a column. Use only what is written. Do not invent a feature, persona, problem, or advantage.",
    "Use each column for this job:",
    "Category, Sub Category, Feature / Composition, and Feature / Composition description say what is being sold. The new belief must stay about that offer.",
    "Solution (for feature/composition) says what the offer does. It is a reason the new belief can replace the old one.",
    "Competitive Advantage says why this offer, not a generic alternative, can make that shift.",
    "Customer Persona says who is being addressed. audience must come from this column. If the rows name different personas, name the shared audience.",
    "Problem and Impact describe the situation the old belief sits in.",
    "Wants and Needs say what the audience hopes the new belief will satisfy.",
    "Hidden Needs is the unspoken stake. Let it shape the new belief even when the audience would not say it.",
    "False Belief is the old belief itself. priorBelief must state that belief in one sentence.",
    "False Belief Impact says why holding that old belief matters.",
    "What Makes Them Stop is the friction the new belief has to overcome.",
    "If False Belief is empty, build priorBelief only from Problem, Impact, and What Makes Them Stop.",
    "plantedBelief is one sentence that replaces priorBelief. It must not repeat the old belief. Do not start it with because or karena.",
    "When several rows are selected, choose the one shared shift those features can make. Do not paste every column into the sentences.",
    "Write priorBelief, plantedBelief, and audience in the same language as the product-knowledge rows.",
    "Return JSON only with this shape:",
    JSON.stringify({ priorBelief: "", plantedBelief: "", audience: "" }),
    "",
    "Selected product knowledge:",
    blocks.join("\n\n"),
  ].join("\n");
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseProductBeliefDraft(raw: unknown): ProductBeliefDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const priorBelief = asText(row.priorBelief);
  const plantedBelief = asText(row.plantedBelief);
  const audience = asText(row.audience);
  if (!priorBelief || !plantedBelief) return null;
  if (beliefsMatch(priorBelief, plantedBelief)) return null;
  if (/^(karena|because)\b/i.test(plantedBelief)) return null;
  return { priorBelief, plantedBelief, audience };
}
