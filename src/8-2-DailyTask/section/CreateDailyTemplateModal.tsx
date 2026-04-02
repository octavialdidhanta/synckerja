import React, { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useDailyTemplates, useDailyTemplate, useDailyTemplateSteps } from '../hooks';
import type {
  DailyTemplateScheduleType,
  DailyTemplateCreate,
  DailyTemplateStepCreate,
} from '../types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

const SCHEDULE_OPTIONS: { value: DailyTemplateScheduleType; label: string }[] = [
  { value: 'days_before_h', label: 'X hari sebelum H' },
  { value: 'hari_h', label: 'Hari H' },
  { value: 'working_days_after_h', label: 'X hari kerja setelah H' },
];

interface StepDraft {
  id: string;
  title: string;
  description: string;
  schedule_type: DailyTemplateScheduleType | null;
  schedule_value: string;
  step_priority: number | null;
}

interface CreateDailyTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  onSuccess?: () => void;
}

export function CreateDailyTemplateModal({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: CreateDailyTemplateModalProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { isOwner } = useCentralizedUserData();
  const { create: createTemplate, update: updateTemplate, isCreating, isUpdating } = useDailyTemplates();
  const { template } = useDailyTemplate(templateId ?? null);
  const { steps: existingSteps } = useDailyTemplateSteps(templateId ?? null);
  const isEditMode = !!templateId;

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<DailyTemplateScheduleType>('hari_h');
  const [formScheduleValue, setFormScheduleValue] = useState('');
  const [formStepPriority, setFormStepPriority] = useState<number>(0);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!organizationId && open,
  });

  const populatedForEditRef = useRef<string | null>(null);
  const createFormResetRef = useRef(false);

  // Reset form when opening in create mode (once per open). Do not depend on existingSteps
  // so that useDailyTemplateSteps(null) returning a new [] each render doesn't retrigger reset.
  useEffect(() => {
    if (!open) {
      populatedForEditRef.current = null;
      createFormResetRef.current = false;
      return;
    }
    if (!templateId) {
      if (!createFormResetRef.current) {
        setName('');
        setDepartmentId('');
        setSteps([]);
        setEditingStepId(null);
        setShowAddForm(false);
        setFormTitle('');
        setFormDescription('');
    setFormScheduleType('hari_h');
    setFormScheduleValue('');
    setFormStepPriority(0);
    createFormResetRef.current = true;
      }
      return;
    }
    // Edit mode: populate when template and steps are ready
    if (template && populatedForEditRef.current !== templateId) {
      setName(template.name);
      setDepartmentId(template.department_id ?? '');
      setSteps(
        existingSteps.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? '',
          schedule_type: s.schedule_type,
          schedule_value: s.schedule_value != null ? String(s.schedule_value) : '',
          step_priority: s.step_priority,
        }))
      );
      setEditingStepId(null);
      setShowAddForm(false);
    setFormTitle('');
    setFormDescription('');
    setFormScheduleType('hari_h');
    setFormScheduleValue('');
    setFormStepPriority(0);
    populatedForEditRef.current = templateId;
    }
  }, [open, templateId, template?.id, template?.name, template?.department_id, existingSteps]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormScheduleType('hari_h');
    setFormScheduleValue('');
    setFormStepPriority(0);
    setEditingStepId(null);
    setShowAddForm(false);
  };

  const handleAddStep = () => {
    if (!formTitle.trim()) return;
    const value = formScheduleValue.trim() ? parseInt(formScheduleValue, 10) : null;
    if (editingStepId) {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === editingStepId
            ?               {
                ...s,
                title: formTitle.trim(),
                description: formDescription.trim(),
                schedule_type: formScheduleType,
                schedule_value: String(value ?? ''),
                step_priority: formStepPriority >= 1 ? formStepPriority : null,
              }
            : s
        )
      );
      toast({ title: t('common.updated') ?? 'Updated', description: t('dailyTask.template.stepUpdated') ?? 'Step updated.' });
    } else {
      setSteps((prev) => [
        ...prev,
        {
          id: `draft-${Date.now()}`,
          title: formTitle.trim(),
          description: formDescription.trim(),
          schedule_type: formScheduleType,
          schedule_value: String(value ?? ''),
          step_priority: formStepPriority >= 1 ? formStepPriority : null,
        },
      ]);
      toast({ title: t('common.added') ?? 'Added', description: t('dailyTask.template.stepAdded') ?? 'Step added.' });
    }
    resetForm();
  };

  const handleEditStep = (step: StepDraft) => {
    setEditingStepId(step.id);
    setFormTitle(step.title);
    setFormDescription(step.description);
    setFormScheduleType((step.schedule_type as DailyTemplateScheduleType) ?? 'hari_h');
    setFormScheduleValue(step.schedule_value);
    setFormStepPriority(step.step_priority ?? 0);
    setShowAddForm(true);
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (editingStepId === id) resetForm();
  };

  const handleSaveTemplate = async () => {
    if (!organizationId || !name.trim()) {
      toast({ title: t('common.error') ?? 'Error', description: t('dailyTask.template.nameRequired') ?? 'Template name is required.', variant: 'destructive' });
      return;
    }
    if (steps.length === 0) {
      toast({ title: t('common.error') ?? 'Error', description: t('dailyTask.template.atLeastOneStep') ?? 'Add at least one step.', variant: 'destructive' });
      return;
    }

    try {
      const payload: DailyTemplateCreate = {
        organization_id: organizationId,
        name: name.trim(),
        department_id: departmentId || null,
        hari_h_date: null,
      };

      if (isEditMode && templateId) {
        await updateTemplate({ id: templateId, payload });
        const { error: delError } = await supabase
          .from('daily_template_steps')
          .delete()
          .eq('daily_template_id', templateId);
        if (delError) throw delError;

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepPayload: DailyTemplateStepCreate = {
            daily_template_id: templateId,
            order: i + 1,
            title: step.title,
            description: step.description.trim() || null,
            step_priority: step.step_priority ?? i + 1,
          };
          if (step.schedule_type != null) {
            stepPayload.schedule_type = (step.schedule_type as DailyTemplateScheduleType) ?? 'hari_h';
            stepPayload.schedule_value = step.schedule_value ? parseInt(step.schedule_value, 10) : null;
          }
          await supabase.from('daily_template_steps').insert({
            ...stepPayload,
            updated_at: new Date().toISOString(),
          });
        }

        toast({ title: t('common.success') ?? 'Success', description: t('dailyTask.template.updated') ?? 'Template updated.' });
      } else {
        const template = await createTemplate(payload);
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepPayload: DailyTemplateStepCreate = {
            daily_template_id: template.id,
            order: i + 1,
            title: step.title,
            description: step.description.trim() || null,
            step_priority: step.step_priority ?? i + 1,
          };
          if (step.schedule_type != null) {
            stepPayload.schedule_type = (step.schedule_type as DailyTemplateScheduleType) ?? 'hari_h';
            stepPayload.schedule_value = step.schedule_value ? parseInt(step.schedule_value, 10) : null;
          }
          await supabase.from('daily_template_steps').insert({
            ...stepPayload,
            updated_at: new Date().toISOString(),
          });
        }
        toast({ title: t('common.success') ?? 'Success', description: t('dailyTask.template.created') ?? 'Template created.' });
      }

      setName('');
      setDepartmentId('');
      setSteps([]);
      resetForm();
      populatedForEditRef.current = null;
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        title: t('common.error') ?? 'Error',
        description: (err as Error)?.message ?? (isEditMode ? t('dailyTask.template.createFailed') : t('dailyTask.template.createFailed')) ?? 'Failed to save template.',
        variant: 'destructive',
      });
    }
  };

  const scheduleLabel = (type: DailyTemplateScheduleType | null, value: string) => {
    if (!type) return '';
    if (type === 'hari_h') return t('dailyTask.template.hariH') ?? 'Hari H';
    const v = value ? parseInt(value, 10) : 0;
    if (type === 'days_before_h') return `${v} hari sebelum H`;
    return `${v} hari kerja setelah H`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[51] flex flex-col h-full w-full sm:max-w-xl p-0 gap-0 overflow-hidden"
      >
        <SheetHeader className="shrink-0 px-6 pt-6 pb-2 border-b">
          <SheetTitle>{isEditMode ? (t('dailyTask.template.editTitle') ?? 'Edit template') : (t('dailyTask.template.createTitle') ?? 'Create template')}</SheetTitle>
          <SheetDescription>{t('dailyTask.template.createDescription') ?? 'Create a daily task template with steps (Hari H or Prioritas).'}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 seamless-scroll px-6 py-4">
          <div className="grid gap-2">
            <Label>{t('dailyTask.template.name') ?? 'Template name'} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dailyTask.template.namePlaceholder') ?? 'Template name'}
            />
          </div>
          {isOwner && (
            <div className="grid gap-2">
              <Label>{t('dailyTask.template.department') ?? 'Department'}</Label>
              <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dailyTask.template.allDepartments') ?? 'All departments'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('dailyTask.template.allDepartments') ?? 'All departments'}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('dailyTask.template.steps') ?? 'Steps'}</span>
            {!showAddForm && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddForm(true);
                }}
                className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer select-none"
              >
                <Plus className="h-4 w-4" />
                {t('dailyTask.template.addStep') ?? 'Add Step'}
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{editingStepId ? (t('dailyTask.template.editStep') ?? 'Edit Step') : (t('dailyTask.template.addStep') ?? 'Add Step')}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2">
                <Label>{t('dailyTask.template.stepTitle') ?? 'Title'} *</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder={t('dailyTask.template.stepTitlePlaceholder') ?? 'Step title'} />
              </div>
              <div className="grid gap-2">
                <Label>{t('dailyTask.template.stepDescription') ?? 'Description'}</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={t('common.optional') ?? 'Optional'} rows={2} />
              </div>
              <div className="grid gap-2">
                <Label>{t('dailyTask.template.schedule') ?? 'Schedule'}</Label>
                <Select value={formScheduleType} onValueChange={(v) => setFormScheduleType(v as DailyTemplateScheduleType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formScheduleType !== 'hari_h' && (
                <div className="grid gap-2">
                  <Label>{t('dailyTask.template.scheduleValue') ?? 'Value (number)'}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formScheduleValue}
                    onChange={(e) => setFormScheduleValue(e.target.value)}
                    placeholder={formScheduleType === 'days_before_h' ? '7' : '3'}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label>{t('dailyTask.template.priority') ?? 'Prioritas'}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formStepPriority < 1 ? '' : formStepPriority}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setFormStepPriority(Number.isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  placeholder={t('dailyTask.template.priority') ?? 'Prioritas'}
                />
                <p className="text-xs text-muted-foreground">
                  {t('dailyTask.template.priorityHint') ?? 'Untuk mengurutkan step di tanggal yang sama (angka kecil = urutan atas).'}
                </p>
              </div>
              <Button onClick={handleAddStep} disabled={!formTitle.trim()}>
                {editingStepId ? (t('common.save') ?? 'Save') : (t('dailyTask.template.addStep') ?? 'Add Step')}
              </Button>
            </div>
          )}

          {steps.length === 0 && !showAddForm ? (
            <p className="text-sm text-muted-foreground">{t('dailyTask.template.noStepsYet') ?? 'No steps yet. Click "Add Step".'}</p>
          ) : (
            <ul className="space-y-2">
              {steps.map((step, idx) => (
                <li key={step.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{idx + 1}. {step.title}</span>
                    {step.schedule_type != null && (
                      <span className="ml-2 text-muted-foreground">({scheduleLabel(step.schedule_type, step.schedule_value)})</span>
                    )}
                    {step.step_priority != null && (
                      <span className="ml-2 text-muted-foreground">({t('dailyTask.template.priority') ?? 'Prioritas'} {step.step_priority})</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditStep(step)} disabled={!!editingStepId}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveStep(step.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel') ?? 'Cancel'}</Button>
          <Button onClick={handleSaveTemplate} disabled={!name.trim() || steps.length === 0 || isCreating || isUpdating}>
            {isEditMode ? (t('common.save') ?? 'Save') : (t('dailyTask.template.createTemplate') ?? 'Create template')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

