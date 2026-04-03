import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useSopTemplate, useSopTemplateSteps } from "../hooks/useSopTemplates";
import type { DefaultPriceRow } from "../types/defaultPrices";
import type { SopScheduleType } from "../types/sopTypes";

const SCHEDULE_OPTIONS: { value: SopScheduleType; label: string }[] = [
  { value: "days_before_h", label: "X hari sebelum H" },
  { value: "hari_h", label: "Hari H" },
  { value: "working_days_after_h", label: "X hari kerja setelah H" },
];

export type SopWorkflowModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPriceRow: DefaultPriceRow | null;
};

export function SopWorkflowModal({ open, onOpenChange, defaultPriceRow }: SopWorkflowModalProps) {
  const { toast } = useToast();
  const defaultPriceId = defaultPriceRow?.id ?? null;
  const { template, isLoading: loadingTemplate, create: createTemplate, refetchTemplate } =
    useSopTemplate(defaultPriceId);
  const {
    steps,
    isLoading: loadingSteps,
    createStep,
    updateStep,
    deleteStep,
    isCreatingStep,
    isUpdatingStep,
    isDeletingStep,
  } = useSopTemplateSteps(template?.id ?? null);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScheduleType, setFormScheduleType] = useState<SopScheduleType>("hari_h");
  const [formScheduleValue, setFormScheduleValue] = useState<string>("");

  useEffect(() => {
    if (open && defaultPriceId && !template && !loadingTemplate) {
      createTemplate({
        default_price_id: defaultPriceId,
        organization_id: defaultPriceRow!.organization_id,
      }).catch((err) => {
        if ((err as { code?: string })?.code === "23505") {
          void refetchTemplate();
        } else {
          toast({ title: "Error", description: "Failed to create SOP template.", variant: "destructive" });
        }
      });
    }
  }, [open, defaultPriceId, template, loadingTemplate, defaultPriceRow, createTemplate, refetchTemplate, toast]);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormScheduleType("hari_h");
    setFormScheduleValue("");
    setEditingStepId(null);
    setShowAddForm(false);
  };

  const handleSaveStep = async () => {
    if (!template?.id || !formTitle.trim()) return;
    const value = formScheduleValue.trim() ? parseInt(formScheduleValue, 10) : null;
    if (editingStepId) {
      await updateStep({
        id: editingStepId,
        payload: {
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          schedule_type: formScheduleType,
          schedule_value: value,
        },
      });
      toast({ title: "Updated", description: "Step updated." });
    } else {
      const nextOrder = steps.length + 1;
      await createStep({
        sop_template_id: template.id,
        order: nextOrder,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        schedule_type: formScheduleType,
        schedule_value: value,
      });
      toast({ title: "Added", description: "Step added." });
    }
    resetForm();
  };

  const handleEdit = (step: {
    id: string;
    title: string;
    description: string | null;
    schedule_type: SopScheduleType;
    schedule_value: number | null;
  }) => {
    setEditingStepId(step.id);
    setFormTitle(step.title);
    setFormDescription(step.description ?? "");
    setFormScheduleType(step.schedule_type);
    setFormScheduleValue(step.schedule_value != null ? String(step.schedule_value) : "");
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!template?.id) return;
    try {
      await deleteStep({ id, sopTemplateId: template.id });
      toast({ title: "Deleted", description: "Step removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete step.", variant: "destructive" });
    }
  };

  const scheduleLabel = (type: SopScheduleType, value: number | null) => {
    if (type === "hari_h") return "Hari H";
    if (type === "days_before_h") return `${value ?? 0} hari sebelum H`;
    return `${value ?? 0} hari kerja setelah H`;
  };

  const isLoading = loadingTemplate || loadingSteps;
  const title = defaultPriceRow
    ? `Workflow / SOP – ${defaultPriceRow.service_name ?? "-"} – ${defaultPriceRow.sub_service_name ?? "-"}`
    : "Workflow / SOP";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto">
          {isLoading && !template ? (
            <div className="py-4 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Steps</span>
                {!showAddForm ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      setShowAddForm(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah Step
                  </Button>
                ) : null}
              </div>

              {showAddForm ? (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{editingStepId ? "Edit Step" : "Tambah Step"}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Label>Title *</Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Step title"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional"
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Schedule</Label>
                    <Select value={formScheduleType} onValueChange={(v) => setFormScheduleType(v as SopScheduleType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formScheduleType !== "hari_h" ? (
                    <div className="grid gap-2">
                      <Label>Nilai (angka)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={formScheduleValue}
                        onChange={(e) => setFormScheduleValue(e.target.value)}
                        placeholder={formScheduleType === "days_before_h" ? "7" : "3"}
                      />
                    </div>
                  ) : null}
                  <Button
                    onClick={() => void handleSaveStep()}
                    disabled={!formTitle.trim() || isCreatingStep || isUpdatingStep}
                  >
                    {editingStepId ? "Simpan" : "Tambah"}
                  </Button>
                </div>
              ) : null}

              {steps.length === 0 && !showAddForm ? (
                <p className="text-sm text-muted-foreground">Belum ada step. Klik &quot;Tambah Step&quot;.</p>
              ) : (
                <ul className="space-y-2">
                  {steps.map((step, idx) => (
                    <li key={step.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">
                          {idx + 1}. {step.title}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          ({scheduleLabel(step.schedule_type, step.schedule_value)})
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(step)}
                          disabled={!!editingStepId || isDeletingStep}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void handleDelete(step.id)}
                          disabled={isDeletingStep}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
