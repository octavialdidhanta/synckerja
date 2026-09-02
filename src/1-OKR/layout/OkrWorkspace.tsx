import type { ReactNode } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { OkrPanelFooter } from "./OkrPanelFooter";
import { OKR_MAIN_GRID, OKR_TABLE_SECTION } from "./okrLayout";

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  count?: number;
};

export function OkrWorkspace({ children, sidebar, count }: Props) {
  return (
    <div className={OKR_MAIN_GRID}>
      <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
        <div className={OKR_TABLE_SECTION}>
          <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border border-border">
            <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
              {children}
            </CardContent>
            <OkrPanelFooter count={count} />
          </Card>
        </div>
      </div>

      <div className="col-span-3 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch">
        <div className={OKR_TABLE_SECTION}>{sidebar}</div>
      </div>
    </div>
  );
}
