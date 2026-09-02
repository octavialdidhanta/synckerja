import type { ReactNode } from "react";
import { EmployeesStaffPanelFooter } from "./EmployeesStaffPanelFooter";
import {
  EMPLOYEES_STAFF_MAIN_GRID,
  EMPLOYEES_STAFF_TABLE_SECTION,
} from "./employeesStaffLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function EmployeesStaffWorkspace({ children, count }: Props) {
  return (
    <div className={EMPLOYEES_STAFF_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={EMPLOYEES_STAFF_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <EmployeesStaffPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
