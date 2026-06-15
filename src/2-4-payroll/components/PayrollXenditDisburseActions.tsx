import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { executeXenditDisbursement } from "@/xendit/lib/xenditApi";

type Props = {
  runId: string | null;
  runStatus?: string;
  onActionComplete?: () => void;
};

export function PayrollXenditDisburseActions({ runId, runStatus, onActionComplete }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const [loading, setLoading] = useState(false);

  if (!runId || runStatus !== "calculated") return null;
  if (!settings?.account?.is_enabled) return null;

  const handleDisburse = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await executeXenditDisbursement(organizationId, {
        source_type: "payroll_run",
        payroll_run_id: runId,
      });
      toast.success(
        t("xendit.payrollDisburseStarted", "Disbursement started: {{ok}} ok, {{fail}} failed", {
          ok: res.processed,
          fail: res.failed,
        }),
      );
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleDisburse} disabled={loading}>
      <Send className="mr-1 h-4 w-4" />
      {loading ? t("xendit.processing", "Processing…") : t("xendit.disbursePayroll", "Disburse via Xendit")}
    </Button>
  );
}
