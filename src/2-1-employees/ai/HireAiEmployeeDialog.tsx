import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { aiEmployeeSeatsQueryKey, useAiEmployeeSeats } from "./useAiEmployeeSeats";

const CONTENT_PLAN_JOB = "content_plan";

export function HireAiEmployeeDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const seatsQuery = useAiEmployeeSeats(organizationId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  const remaining = seatsQuery.data?.remaining ?? 0;
  const seatsKnown = seatsQuery.isSuccess;
  const full = seatsKnown && remaining < 1;

  const hire = async () => {
    const fullName = name.trim();
    if (!fullName) {
      toast({
        title: t("aiEmployee.hire.nameRequired", "Isi nama karyawan AI."),
        variant: "destructive",
      });
      return;
    }
    if (full) {
      toast({
        title: t("aiEmployee.hire.full", "Kursi karyawan AI sudah penuh."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("hire_ai_employee", {
      p_organization_id: organizationId,
      p_full_name: fullName,
      p_job_code: CONTENT_PLAN_JOB,
    });
    setSaving(false);
    if (error) {
      toast({
        title: t("aiEmployee.hire.failed", "Karyawan AI belum bisa direkrut."),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employees-optimized", organizationId] }),
      queryClient.invalidateQueries({ queryKey: aiEmployeeSeatsQueryKey(organizationId) }),
    ]);
    toast({
      title: t("aiEmployee.hire.done", "Karyawan AI Content Plan direkrut."),
      description: fullName,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("aiEmployee.hire.title", "Rekrut karyawan AI")}</DialogTitle>
          <DialogDescription>
            {seatsKnown
              ? t("aiEmployee.hire.seats", "Sisa kursi: {{count}}. Satu kursi untuk satu job desc.", { count: remaining })
              : t("aiEmployee.hire.seatsUnknown", "Satu kursi untuk satu job desc yang sudah tersedia.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-employee-name">{t("aiEmployee.hire.name", "Nama")}</Label>
            <Input
              id="ai-employee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              disabled={saving || full}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-employee-job">{t("aiEmployee.hire.job", "Job desc")}</Label>
            <select
              id="ai-employee-job"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={CONTENT_PLAN_JOB}
              disabled={saving || full}
              onChange={() => undefined}
            >
              <option value={CONTENT_PLAN_JOB}>{t("aiEmployee.hire.contentPlan", "Content Plan")}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {t("aiEmployee.hire.onlyBuilt", "Job desc lain belum bisa dipilih.")}
            </p>
          </div>
          {full ? (
            <p className="text-sm text-destructive">
              {t("aiEmployee.hire.full", "Kursi karyawan AI sudah penuh.")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="button" onClick={() => void hire()} disabled={saving || full || !name.trim()}>
            {saving ? t("aiEmployee.hire.saving", "Merekrut...") : t("aiEmployee.hire.submit", "Rekrut")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
