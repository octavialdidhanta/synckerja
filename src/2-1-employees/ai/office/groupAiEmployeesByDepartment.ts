import type { Employee } from "../../hooks/useEmployees";

export type OfficeBay = {
  id: string;
  name: string;
  employees: Employee[];
};

export function groupAiEmployeesByDepartment(employees: Employee[], unassignedLabel: string): OfficeBay[] {
  const groups = new Map<string, OfficeBay>();
  for (const employee of employees) {
    const name = employee.department_name?.trim() || unassignedLabel;
    const id = name.toLocaleLowerCase();
    const current = groups.get(id) ?? { id, name, employees: [] };
    current.employees.push(employee);
    groups.set(id, current);
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "id"));
}
