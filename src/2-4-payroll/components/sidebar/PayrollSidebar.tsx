import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { PayrollPeriodsOverview } from "../overview/PayrollPeriodsOverview";
import { PayrollRunsOverview } from "../overview/PayrollRunsOverview";
import { CreatePeriodDialog } from "../../modals/CreatePeriodDialog";
import { CreatePayrollRunDialog } from "../../modals/CreatePayrollRunDialog";
import { PayrollSidebarFooter } from "./PayrollSidebarFooter";
import { TaxCalculationModeSetting } from "../TaxCalculationModeSetting";
import { PayrollEscrowSettingsSection } from "../../settings/PayrollEscrowSettingsSection";
import { PayrollExpenseSettingsSection } from "../../expense/components/PayrollExpenseSettingsSection";

const TAB_PANEL_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface PayrollSidebarProps {
  selectedPayrollRunId?: string | null;
  onPayrollRunSelect?: (runId: string | null) => void;
  onRunBlocked?: (message: string | null) => void;
}

export function PayrollSidebar({
  selectedPayrollRunId,
  onPayrollRunSelect,
  onRunBlocked,
}: PayrollSidebarProps) {
  const [activeTab, setActiveTab] = useState("periods");
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      <div className="border-border shrink-0 border-b px-4 py-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground text-sm font-semibold">Payroll Overview</h3>
            <p className="text-muted-foreground mt-1 text-xs">Latest payroll periods and runs</p>
          </div>
          {activeTab === "periods" && (
            <Button
              onClick={() => setIsCreatePeriodOpen(true)}
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-3 text-xs whitespace-nowrap"
            >
              <Calendar className="h-3.5 w-3.5" />
              New Period
            </Button>
          )}
          {activeTab === "runs" && (
            <CreatePayrollRunDialog>
              <Button size="sm" className="h-8 shrink-0 gap-1.5 px-3 text-xs whitespace-nowrap">
                <Clock className="h-3.5 w-3.5" />
                New Run
              </Button>
            </CreatePayrollRunDialog>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="shrink-0 px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="periods">Periods</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <TabsContent
            value="periods"
            className="absolute inset-0 mt-0 flex flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className={cn(TAB_PANEL_SCROLL, "px-4 pb-3 pt-3")}>
              <PayrollPeriodsOverview />
            </div>
          </TabsContent>
          <TabsContent
            value="runs"
            className="absolute inset-0 mt-0 flex flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className={cn(TAB_PANEL_SCROLL, "px-4 pb-3 pt-3")}>
              <PayrollRunsOverview
                selectedRunId={selectedPayrollRunId}
                onRunSelect={onPayrollRunSelect}
                onRunBlocked={onRunBlocked}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="shrink-0 space-y-0 border-t border-border px-4 pb-2 pt-2">
        <TaxCalculationModeSetting />
        <PayrollEscrowSettingsSection />
        <PayrollExpenseSettingsSection />
      </div>

      <PayrollSidebarFooter activeTab={activeTab} />

      <CreatePeriodDialog open={isCreatePeriodOpen} onOpenChange={setIsCreatePeriodOpen} />
    </div>
  );
}
