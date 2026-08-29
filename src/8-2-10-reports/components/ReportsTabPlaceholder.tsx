import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsModuleShell } from "../layout/ReportsModuleShell";

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
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
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
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </ReportsModuleShell>
  );
}
