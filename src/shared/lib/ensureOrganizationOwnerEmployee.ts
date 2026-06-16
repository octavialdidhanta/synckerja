import { supabase } from '@/shared/lib/supabaseClient';

export type EnsureOrganizationOwnerEmployeeInput = {
  organizationId: string;
  userId: string;
  fullName: string;
  email?: string | null;
};

export type EnsureOrganizationOwnerEmployeeResult = {
  employeeId: string;
  created: boolean;
};

/**
 * Each organization needs its own employees row for the owner (multi-org users
 * may already have employee records in other organizations).
 */
export async function ensureOrganizationOwnerEmployee(
  input: EnsureOrganizationOwnerEmployeeInput,
): Promise<EnsureOrganizationOwnerEmployeeResult> {
  const organizationId = input.organizationId.trim();
  const userId = input.userId.trim();
  const fullName = input.fullName.trim() || 'Owner';

  const { data: existing, error: existingError } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) {
    return { employeeId: existing.id, created: false };
  }

  const { data: activeStatus } = await supabase
    .from('employee_statuses')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', 'active')
    .limit(1)
    .maybeSingle();

  const { data: defaultDepartment } = await supabase
    .from('departments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);

  const { data: inserted, error: insertError } = await supabase
    .from('employees')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      full_name: fullName,
      email: input.email?.trim() || null,
      employee_status_id: activeStatus?.id ?? null,
      department_id: defaultDepartment?.id ?? null,
      join_date: today,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error('Failed to create owner employee');

  return { employeeId: inserted.id, created: true };
}
