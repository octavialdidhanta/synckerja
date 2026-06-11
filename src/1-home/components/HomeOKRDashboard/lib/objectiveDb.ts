/** Map UI "why important" text to DB `description` (dept/individual tables have no why_important column). */

export function objectiveDescriptionFromForm(parts: {
  description?: string;
  why_important?: string;
}): string | null {
  const why = parts.why_important?.trim() ?? "";
  const desc = parts.description?.trim() ?? "";
  if (why && desc && why !== desc) return `${why}\n\n${desc}`;
  return why || desc || null;
}

export function whyImportantFromRow(row: {
  why_important?: string | null;
  description?: string | null;
}): string {
  return row.why_important?.trim() || row.description?.trim() || "";
}

const DEPARTMENT_WRITE_KEYS = [
  "organization_id",
  "cycle_id",
  "company_objective_id",
  "department_id",
  "title",
  "description",
  "status",
  "progress_percentage",
  "weight",
  "start_date",
  "end_date",
  "owner_id",
  "created_by",
] as const;

const INDIVIDUAL_WRITE_KEYS = [
  "organization_id",
  "cycle_id",
  "department_objective_id",
  "employee_id",
  "title",
  "description",
  "status",
  "progress_percentage",
  "weight",
  "start_date",
  "end_date",
  "created_by",
] as const;

function pickKeys(
  data: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

export function sanitizeDepartmentObjectiveWrite(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const mergedDescription = objectiveDescriptionFromForm({
    description:
      typeof data.description === "string" ? data.description : undefined,
    why_important:
      typeof data.why_important === "string" ? data.why_important : undefined,
  });

  const base = pickKeys(data, DEPARTMENT_WRITE_KEYS);
  if (mergedDescription != null) {
    base.description = mergedDescription;
  }
  return base;
}

export function sanitizeIndividualObjectiveWrite(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const mergedDescription = objectiveDescriptionFromForm({
    description:
      typeof data.description === "string" ? data.description : undefined,
    why_important:
      typeof data.why_important === "string" ? data.why_important : undefined,
  });

  const base = pickKeys(data, INDIVIDUAL_WRITE_KEYS);
  if (mergedDescription != null) {
    base.description = mergedDescription;
  }
  return base;
}
