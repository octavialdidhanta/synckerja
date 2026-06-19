import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PayrollExpenseClassification } from "./payrollExpenseTypes.ts";

async function resolveExpenseType(
  admin: SupabaseClient,
  organizationId: string,
  typeName: string,
): Promise<{ id: string; name: string } | null> {
  const { data: orgRow } = await admin
    .from("expense_types")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", typeName.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (orgRow?.id) return { id: String(orgRow.id), name: String(orgRow.name) };

  const { data: templateRow } = await admin
    .from("expense_types")
    .select("id, name")
    .is("organization_id", null)
    .ilike("name", typeName.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (templateRow?.id) return { id: String(templateRow.id), name: String(templateRow.name) };
  return null;
}

async function resolveExpenseCategory(
  admin: SupabaseClient,
  organizationId: string,
  categoryName: string,
  expenseTypeId: string,
): Promise<{ id: string; name: string } | null> {
  const base = admin
    .from("expense_categories")
    .select("id, name, organization_id")
    .ilike("name", categoryName.trim())
    .eq("is_active", true)
    .or(`expense_type_id.eq.${expenseTypeId},expense_type_id.is.null`);

  const { data: orgRows } = await base
    .eq("organization_id", organizationId);

  if (orgRows?.[0]?.id) {
    return { id: String(orgRows[0].id), name: String(orgRows[0].name) };
  }

  const { data: templateRows } = await admin
    .from("expense_categories")
    .select("id, name")
    .is("organization_id", null)
    .ilike("name", categoryName.trim())
    .eq("is_active", true)
    .or(`expense_type_id.eq.${expenseTypeId},expense_type_id.is.null`)
    .limit(1);

  if (templateRows?.[0]?.id) {
    return { id: String(templateRows[0].id), name: String(templateRows[0].name) };
  }

  return null;
}

export async function resolvePayrollExpenseClassification(
  admin: SupabaseClient,
  organizationId: string,
  settings: { expense_type_name: string; expense_category_name: string },
): Promise<PayrollExpenseClassification | null> {
  const type = await resolveExpenseType(admin, organizationId, settings.expense_type_name);
  if (!type) return null;

  const category = await resolveExpenseCategory(
    admin,
    organizationId,
    settings.expense_category_name,
    type.id,
  );
  if (!category) return null;

  return {
    type_id: type.id,
    type_name: type.name,
    category_id: category.id,
    category_name: category.name,
  };
}
