import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsModuleShell } from "../layout/ReportsModuleShell";
import { ReportsWorkspace } from "../layout/ReportsWorkspace";

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Shared placeholder panel until report widgets are implemented. */
export function ReportsTabPlaceholder({ title, description, children }: Props) {
  const { t } = useAppTranslation();
  return (
    <ReportsModuleShell showContent>
      <ReportsWorkspace>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            {children ?? (
              <p className="text-sm text-muted-foreground">
                {t("reports.placeholder.body", "Report content will appear here.")}
              </p>
            )}
          </div>
        </div>
      </ReportsWorkspace>
    </ReportsModuleShell>
  );
}
