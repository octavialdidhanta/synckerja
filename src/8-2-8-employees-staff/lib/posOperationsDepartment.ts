import { supabase } from "@/shared/lib/supabaseClient";

/** Canonical HR department name for POS New invite staff. */
export const POS_OPERATIONS_DEPARTMENT_NAME = "Operations";

/** Case-insensitive aliases that reuse an existing org department (no duplicate create). */
export const POS_OPERATIONS_DEPARTMENT_ALIASES = ["operations", "operasional"] as const;

export const POS_OPERATIONS_DEPARTMENT_DESCRIPTION = "POS / outlet staff";

export const POS_OPERATIONS_DEPARTMENT_CODE = "operations";

type DeptRow = { id: string; name: string };

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique");
}

function pickPreferredDepartment(rows: DeptRow[]): DeptRow | null {
  if (rows.length === 0) return null;
  const exact = rows.find((r) => r.name === POS_OPERATIONS_DEPARTMENT_NAME);
  if (exact) return exact;
  const ops = rows.find((r) => r.name.toLowerCase() === "operations");
  if (ops) return ops;
  return rows[0] ?? null;
}

async function findOperationsDepartment(organizationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw error;

  const aliases = new Set<string>(POS_OPERATIONS_DEPARTMENT_ALIASES);
  const matches = ((data ?? []) as DeptRow[]).filter((row) =>
    aliases.has(row.name.trim().toLowerCase()),
  );
  return pickPreferredDepartment(matches)?.id ?? null;
}

/**
 * Find-or-create the org HR department used for POS New invite employees.
 * Reuses "Operations" / "Operasional" (case-insensitive). Never sets is_default.
 */
export async function ensurePosOperationsDepartment(organizationId: string): Promise<string> {
  if (!organizationId) throw new Error("Organization ID is required");

  const existing = await findOperationsDepartment(organizationId);
  if (existing) return existing;

  const basePayload = {
    organization_id: organizationId,
    name: POS_OPERATIONS_DEPARTMENT_NAME,
    description: POS_OPERATIONS_DEPARTMENT_DESCRIPTION,
    is_active: true,
    is_default: false,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("departments")
    .insert({ ...basePayload, code: POS_OPERATIONS_DEPARTMENT_CODE })
    .select("id")
    .single();

  if (!insertError && inserted?.id) {
    return inserted.id as string;
  }

  if (isUniqueViolation(insertError)) {
    const raced = await findOperationsDepartment(organizationId);
    if (raced) return raced;

    // Name unique OK but code may collide globally — retry without code.
    const { data: retry, error: retryError } = await supabase
      .from("departments")
      .insert(basePayload)
      .select("id")
      .single();

    if (!retryError && retry?.id) {
      return retry.id as string;
    }

    if (isUniqueViolation(retryError)) {
      const again = await findOperationsDepartment(organizationId);
      if (again) return again;
    }

    throw retryError ?? insertError ?? new Error("operations_department_create_failed");
  }

  throw insertError ?? new Error("operations_department_create_failed");
}
