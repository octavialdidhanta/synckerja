import type { ReactNode } from "react";
import { ApplicationsPanelFooter } from "./ApplicationsPanelFooter";
import { RECRUITMENT_TABLE_SECTION } from "../../layout/recruitmentIntervieweesLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function ApplicationsWorkspace({ children, count }: Props) {
  return (
    <div className={RECRUITMENT_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        <ApplicationsPanelFooter count={count} />
      </div>
    </div>
  );
}
