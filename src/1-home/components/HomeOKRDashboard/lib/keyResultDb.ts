/** Columns that exist on public.key_results (hosted Synckerja Office schema). */
export const KEY_RESULT_SELECT_COLUMNS =
  "id, title, target_value, current_value, unit, metric_type, progress_percentage, weight, company_objective_id, department_objective_id, individual_objective_id, created_at, updated_at";

export type KeyResultDbWrite = {
  title: string;
  target_value?: number | null;
  current_value?: number | null;
  unit?: string | null;
  metric_type?: string | null;
  progress_percentage?: number;
  weight?: number;
  company_objective_id?: string | null;
  department_objective_id?: string | null;
  individual_objective_id?: string | null;
};

const WRITE_KEYS: (keyof KeyResultDbWrite)[] = [
  "title",
  "target_value",
  "current_value",
  "unit",
  "metric_type",
  "progress_percentage",
  "weight",
  "company_objective_id",
  "department_objective_id",
  "individual_objective_id",
];

/** Strip UI-only fields (calculation_type, start_value, organization_id, etc.) before insert/update. */
export function pickKeyResultDbWrite(data: Record<string, unknown>): KeyResultDbWrite {
  const out: Record<string, unknown> = {};
  for (const key of WRITE_KEYS) {
    if (data[key] !== undefined) {
      out[key] = data[key];
    }
  }
  return out as KeyResultDbWrite;
}
