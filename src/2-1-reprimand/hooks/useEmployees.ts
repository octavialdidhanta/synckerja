import { useMemo } from "react";
import { useEmployees as useOrgEmployees } from "@/2-1-employees/hooks/useEmployees";
import { isEmployeeActive } from "@/2-1-employees/utils/employeeUtils";

/**
 * Shape expected by reprimand UI (matches synckerja-reference field names).
 * `employee_id` is an optional HR code on some DBs; this project often has only `employees.id` —
 * we map from the canonical {@link useOrgEmployees} fetch to avoid PostgREST 42703 on missing columns.
 */
export interface EmployeeData {
  id: string;
  full_name: string;
  email: string;
  /** Display code when present on row; otherwise empty (UI shows "No ID" fallback). */
  employee_id: string;
  profile_photo_url?: string;
  photo_url?: string;
  status?: string;
  employee_status_id?: string | null;
  employee_status_name?: string | null;
  pending_removal?: boolean | null;
  join_date?: string;
  organization_id: string;
  departments?: { name: string };
  job_positions?: { name: string };
}

export const useEmployees = () => {
  const { data: rawList, isPending, error, refetch } = useOrgEmployees();

  const employees = useMemo(() => {
    const list = rawList ?? [];
    return list
      .map(
        (emp): EmployeeData => ({
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email,
          employee_id: emp.employee_id?.trim() ? emp.employee_id : "",
          profile_photo_url: emp.profile_photo_url,
          photo_url: emp.photo_url,
          status: emp.status,
          employee_status_id: emp.employee_status_id ?? null,
          employee_status_name: emp.employee_status_name ?? null,
          pending_removal: emp.pending_removal ?? null,
          join_date: emp.join_date,
          organization_id: emp.organization_id,
          departments: emp.department_name ? { name: emp.department_name } : undefined,
          job_positions: emp.job_position_name ? { name: emp.job_position_name } : undefined,
        }),
      )
      .filter((e) => isEmployeeActive(e));
  }, [rawList]);

  return {
    employees,
    isPending,
    isLoading: isPending,
    error,
    refetch,
  };
};
