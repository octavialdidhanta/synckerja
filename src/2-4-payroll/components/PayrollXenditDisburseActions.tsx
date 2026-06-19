import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { mfaSecuritySettingsPath } from "@/shared/auth/mfa/mfaSettingsPaths";
import { usePayrollXenditDisburse } from "../hooks/usePayrollXenditDisburse";
import { PayrollXenditDisbursePanel } from "./PayrollXenditDisbursePanel";

type Flow = ReturnType<typeof usePayrollXenditDisburse>;

type SharedProps = {
  runId: string | null;
  runStatus?: string;
  hasActiveDisbursement?: boolean;
  onActionComplete?: () => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
};

export function usePayrollXenditDisburseFlow(props: SharedProps) {
  return usePayrollXenditDisburse(props);
}

export function PayrollXenditDisburseButton({ flow }: { flow: Flow }) {
  const { t } = useTranslation();
  const { panelOpen, togglePanel, loading, canDisburse, disabledReason, mfaBlocked, hasActiveDisbursement } =
    flow;

  const button = (
    <Button
      type="button"
      size="sm"
      variant={panelOpen ? "default" : "outline"}
      className={cn("shrink-0", panelOpen && "shadow-sm")}
      aria-expanded={panelOpen}
      onClick={togglePanel}
      disabled={loading || (!canDisburse && !panelOpen)}
    >
      <Send className="mr-1.5 h-4 w-4" />
      {loading
        ? t("xendit.processing", "Memproses…")
        : hasActiveDisbursement
          ? t("payroll.xendit.disbursing", "Disbursing…")
          : t("xendit.disbursePayroll", "Disburse via Xendit")}
    </Button>
  );

  if (!canDisburse && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">{button}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {mfaBlocked ? (
              <span>
                {disabledReason}{" "}
                <Link to={mfaSecuritySettingsPath()} className="underline">
                  {t("payroll.xendit.mfaEnrollLink", "Buka Pengaturan Keamanan")}
                </Link>
              </span>
            ) : (
              disabledReason
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

export function PayrollXenditDisbursePanelSection({ flow }: { flow: Flow }) {
  const { panelOpen, closePanel, runId, loading, handleDisburse, cashBalance } = flow;

  if (!panelOpen || !runId) return null;

  return (
    <PayrollXenditDisbursePanel
      active={panelOpen}
      onCancel={closePanel}
      runId={runId}
      xenditUsableBalance={cashBalance.balance}
      aggregateBalance={cashBalance.aggregateBalance}
      selectableCount={cashBalance.selectableCount}
      balanceSyncing={cashBalance.isSyncing}
      balanceSyncedAt={cashBalance.syncedAt}
      balanceSyncError={cashBalance.syncError}
      confirming={loading}
      fillHeight
      onConfirm={handleDisburse}
    />
  );
}

/** @deprecated Use PayrollXenditDisburseButton + PayrollXenditDisbursePanelSection in PayrollRunActions */
export function PayrollXenditDisburseActions({
  panelOpen,
  onPanelOpenChange,
  ...props
}: SharedProps) {
  const flow = usePayrollXenditDisburse({ ...props, panelOpen, onPanelOpenChange });
  if (!flow.visible) return null;

  return (
    <>
      <PayrollXenditDisburseButton flow={flow} />
      <PayrollXenditDisbursePanelSection flow={flow} />
    </>
  );
}
