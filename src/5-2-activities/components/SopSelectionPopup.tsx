import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '@/shared/lib/logger';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import {
  useSopTemplateByService,
  useSopTemplatesList,
  useSopTemplateSteps,
  createTaskFromSop,
  SopWorkflowModal,
} from '@/8-2-1-default-prices';
import type { TaskFormData } from '@/8-2-DailyTask/section/CreateTaskDialog';
import type { SopTemplateStep } from '@/8-2-1-default-prices';

interface SopSelectionPopupProps {
  open: boolean;
  onClose: () => void;
  formData: TaskFormData | null;
  serviceId: string | null;
  subServiceId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function scheduleLabel(step: SopTemplateStep): string {
  if (step.schedule_type === 'hari_h') return 'Hari H';
  if (step.schedule_type === 'days_before_h') return `${step.schedule_value ?? 0} hari sebelum H`;
  return `${step.schedule_value ?? 0} hari kerja setelah H`;
}

export const SopSelectionPopup = ({
  open,
  onClose,
  formData,
  serviceId,
  subServiceId,
  onSuccess,
  onCancel,
}: SopSelectionPopupProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { defaultPriceId, defaultPriceRow, sopTemplate: defaultSop, steps: defaultSteps, hasSop, isLoading } = useSopTemplateByService(serviceId, subServiceId);
  const { list: templatesList } = useSopTemplatesList();
  const [selectedSopTemplateId, setSelectedSopTemplateId] = useState<string | null>(null);
  const [tanggalHariH, setTanggalHariH] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const stepsFromSelected = useSopTemplateSteps(selectedSopTemplateId);
  const steps = selectedSopTemplateId === defaultSop?.id ? defaultSteps : stepsFromSelected.steps;

  useEffect(() => {
    if (open && defaultSop?.id) {
      setSelectedSopTemplateId(defaultSop.id);
    }
  }, [open, defaultSop?.id]);

  useEffect(() => {
    if (!open) {
      setTanggalHariH('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!formData || !organizationId || !selectedSopTemplateId || !steps.length || !tanggalHariH.trim()) {
      if (!hasSop) return;
      toast({ title: 'Error', description: 'Pilih template SOP dan isi Tanggal Hari H.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const currentUserEmployeeId = formData.assigned_to || null;
      await createTaskFromSop({
        formData: {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
          objective_id: formData.objective_id,
          assigned_to: formData.assigned_to,
          plan_date: formData.plan_date,
          due_date: formData.due_date,
        },
        organizationId,
        createdByUserId: user?.id ?? null,
        assignedToEmployeeId: currentUserEmployeeId,
        sopTemplateId: selectedSopTemplateId,
        steps,
        tanggalHariH: tanggalHariH.trim(),
      });
      toast({ title: 'Success', description: 'Task dan step dibuat.' });
      onSuccess();
      onClose();
    } catch (err) {
      devLog.error(err);
      toast({ title: 'Error', description: 'Gagal membuat task dari SOP.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const showNoSop = open && !isLoading && !hasSop;
  const showNoSopButHasDefaultPrice = showNoSop && !!defaultPriceRow;
  const showNoDefaultPrice = showNoSop && !defaultPriceRow;
  const showForm = open && hasSop && formData;

  const handleWorkflowModalClose = (isOpen: boolean) => {
    if (!isOpen) {
      queryClient.invalidateQueries({ queryKey: ['sop-template-by-service', organizationId, serviceId, subServiceId] });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pilih SOP / Workflow</DialogTitle>
          </DialogHeader>
          {isLoading && (
            <div className="py-4 text-center text-muted-foreground">Loading...</div>
          )}
          {showNoDefaultPrice && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Belum ada SOP untuk Service dan Kategori ini. Buat SOP terlebih dahulu di halaman Product & Service (Default Prices).
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Batal</Button>
                <Button onClick={onClose}>OK</Button>
              </DialogFooter>
            </div>
          )}
          {showNoSopButHasDefaultPrice && (
            <p className="text-sm text-muted-foreground py-2">
              Belum ada step SOP. Buat workflow di bawah (judul &quot;Workflow / SOP – …&quot;), lalu tutup untuk memilih template dan Buat Task & Step.
            </p>
          )}
          {showForm && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Template SOP</Label>
              <Select
                value={selectedSopTemplateId ?? ''}
                onValueChange={(v) => setSelectedSopTemplateId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih template" />
                </SelectTrigger>
                <SelectContent>
                  {defaultSop && (
                    <SelectItem value={defaultSop.id}>
                      Default (Service + Kategori ini)
                    </SelectItem>
                  )}
                  {templatesList
                    .filter((t) => t.id !== defaultSop?.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.service_name ?? ''} – {t.sub_service_name ?? ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {steps.length > 0 && (
              <div className="grid gap-2">
                <Label>Step</Label>
                <ul className="rounded-md border p-2 text-sm space-y-1">
                  {steps.map((step, i) => (
                    <li key={step.id}>
                      {i + 1}. {step.title} ({scheduleLabel(step)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tanggal Hari H *</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={tanggalHariH}
                onChange={(e) => setTanggalHariH(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel} disabled={submitting}>Batal</Button>
              <Button onClick={handleConfirm} disabled={submitting || !tanggalHariH.trim()}>
                {submitting ? 'Membuat...' : 'Buat Task & Step'}
              </Button>
            </DialogFooter>
          </div>
          )}
        </DialogContent>
      </Dialog>
      {showNoSopButHasDefaultPrice && defaultPriceRow && (
        <SopWorkflowModal
          open={true}
          defaultPriceRow={defaultPriceRow}
          onOpenChange={handleWorkflowModalClose}
        />
      )}
    </>
  );
};
