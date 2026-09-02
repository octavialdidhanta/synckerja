import type { ReactNode } from "react";
import { AttendancePanelFooter } from "./AttendancePanelFooter";
import { ATTENDANCE_TABLE_SECTION } from "./attendanceLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

/** Full-width card + pinned footer — dashboard (`/attendance`) and similar single-column panels. */
export function AttendanceWorkspace({ children, count }: Props) {
  return (
    <div className={ATTENDANCE_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        <AttendancePanelFooter count={count} />
      </div>
    </div>
  );
}
