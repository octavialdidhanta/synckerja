import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCustomerSurveyAssigneeTargetMutations } from "@/features/customer-survey/hooks/useCustomerSurveyAssigneeTarget";

type Props = {
  organizationId: string;
  assigneeId: string | null;
  targetPct: number;
  hasAssigneeOverride: boolean;
  canEdit: boolean;
};

export function AssigneeSurveyTargetCell({
  organizationId,
  assigneeId,
  targetPct,
  hasAssigneeOverride,
  canEdit,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(targetPct));
  const { upsertMutation, clearMutation } = useCustomerSurveyAssigneeTargetMutations(organizationId);

  const saving = upsertMutation.isPending || clearMutation.isPending;

  const handleSave = async () => {
    if (!assigneeId) return;
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error(t("crm.customerSurvey.targetInvalid", "Target must be between 0 and 100"));
      return;
    }
    try {
      await upsertMutation.mutateAsync({ assigneeId, targetPct: n });
      toast.success(t("crm.customerSurvey.targetEditSuccess", "Agent target updated"));
      setOpen(false);
    } catch {
      toast.error(t("crm.customerSurvey.targetEditFailed", "Failed to update target"));
    }
  };

  const handleUseOrgTarget = async () => {
    if (!assigneeId || !hasAssigneeOverride) return;
    try {
      await clearMutation.mutateAsync(assigneeId);
      toast.success(t("crm.customerSurvey.targetEditSuccess", "Agent target updated"));
      setOpen(false);
    } catch {
      toast.error(t("crm.customerSurvey.targetEditFailed", "Failed to update target"));
    }
  };

  if (!assigneeId) {
    return <span className="tabular-nums text-muted-foreground">{targetPct}%</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="tabular-nums">{targetPct}%</span>
      {hasAssigneeOverride ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="rounded px-1 text-[10px] font-medium uppercase tracking-wide text-primary"
              aria-label={t("crm.customerSurvey.targetCustomOverride", "Custom target")}
            >
              *
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t("crm.customerSurvey.targetCustomOverride", "Custom target")}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {canEdit ? (
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(String(targetPct));
            setOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={t("crm.customerSurvey.editTarget", "Edit target")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="end">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`survey-target-${assigneeId}`} className="text-xs">
                  {t("crm.customerSurvey.colTargetPct", "Target % promoters")}
                </Label>
                <Input
                  id={`survey-target-${assigneeId}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-8 text-sm"
                  disabled={saving}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Button type="button" size="sm" className="h-8 w-full" disabled={saving} onClick={handleSave}>
                  {t("crm.customerSurvey.saveTarget", "Save")}
                </Button>
                {hasAssigneeOverride ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full text-xs"
                    disabled={saving}
                    onClick={handleUseOrgTarget}
                  >
                    {t("crm.customerSurvey.useOrgTarget", "Use organization target")}
                  </Button>
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
