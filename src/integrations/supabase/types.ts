import type { Employee as EmployeesRow } from "@/2-1-employees/hooks/useEmployees";

/** Legacy shim for My Info hooks; aligns with list `Employee` shape from `useEmployees`. */
export type Tables<TableName extends string> = TableName extends "employees"
  ? EmployeesRow
  : Record<string, unknown>;
