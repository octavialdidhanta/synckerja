type ConditionRule = {
  field?: string;
  operator?: string;
  value?: string;
};

type EnrollmentContext = {
  messageBody?: string;
  conversationStatus?: string | null;
  labelNames?: string[];
};

function matchRule(rule: ConditionRule, ctx: EnrollmentContext): boolean {
  const field = String(rule.field ?? "");
  const operator = String(rule.operator ?? "contains");
  const value = String(rule.value ?? "").trim().toLowerCase();

  let actual = "";
  if (field === "keyword") actual = (ctx.messageBody ?? "").toLowerCase();
  else if (field === "conversation_status") actual = (ctx.conversationStatus ?? "").toLowerCase();
  else if (field === "label") {
    const labels = (ctx.labelNames ?? []).map((l) => l.toLowerCase());
    if (operator === "contains") return labels.some((l) => l.includes(value));
    if (operator === "equals") return labels.includes(value);
    if (operator === "not_equals") return !labels.includes(value);
    if (operator === "is_empty") return labels.length === 0;
    if (operator === "is_not_empty") return labels.length > 0;
    return false;
  }

  if (operator === "contains") return actual.includes(value);
  if (operator === "equals") return actual === value;
  if (operator === "not_equals") return actual !== value;
  if (operator === "is_empty") return actual.length === 0;
  if (operator === "is_not_empty") return actual.length > 0;
  return false;
}

export function evaluateConditionRules(
  rules: ConditionRule[],
  matchMode: "all" | "any",
  ctx: EnrollmentContext,
): boolean {
  if (!rules.length) return true;
  if (matchMode === "any") return rules.some((r) => matchRule(r, ctx));
  return rules.every((r) => matchRule(r, ctx));
}

export function matchesEnrollmentFilters(
  filters: ConditionRule[],
  ctx: EnrollmentContext,
): boolean {
  if (!filters.length) return true;
  return evaluateConditionRules(filters, "all", ctx);
}

export type ReEnrollmentRule = "not_in_flow" | "never" | "always";

export function canEnroll(
  rule: ReEnrollmentRule,
  hasActiveEnrollment: boolean,
  hasAnyPastEnrollment: boolean,
): boolean {
  if (rule === "always") return true;
  if (rule === "never") return !hasAnyPastEnrollment;
  return !hasActiveEnrollment;
}
