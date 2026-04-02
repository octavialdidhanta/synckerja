import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Resolves a tax_configuration_id for payroll runs when RPC `create_default_tax_configuration` is not deployed.
 */
export async function ensureTaxConfigurationId(organizationId: string): Promise<string> {
  const { data: fromEmployee } = await supabase
    .from("employee_payroll_info")
    .select("tax_configuration_id")
    .eq("organization_id", organizationId)
    .not("tax_configuration_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (fromEmployee?.tax_configuration_id) {
    return fromEmployee.tax_configuration_id;
  }

  const { data: defaultRow } = await supabase
    .from("tax_configurations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultRow?.id) {
    return defaultRow.id;
  }

  const { data: inserted, error } = await supabase
    .from("tax_configurations")
    .insert({
      organization_id: organizationId,
      name: "Default",
      ptkp_amount: 54000000,
      ptkp_status: "TK/0",
      tax_rate: 0,
      is_default: true,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return inserted.id;
}
