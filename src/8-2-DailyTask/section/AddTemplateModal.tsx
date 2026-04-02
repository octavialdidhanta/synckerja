import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { Layers, ArrowLeft, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { CustomDatePicker } from '@/shared/calendar';
import { useDailyTemplatesWithStepCount, useDailyTemplateSteps, useDailyTemplates } from '../hooks';
import { applyDailyTemplateToTask } from '../services/applyDailyTemplateService';
import { useDailyTask } from '../context/DailyTaskContext';
import { CreateDailyTemplateModal } from './CreateDailyTemplateModal';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { DailyTemplateScheduleType } from '../types';

export interface AddTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  onSuccess?: () => void;
}

export function AddTemplateModal({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  onSuccess,
}: AddTemplateModalProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { refetchTasks } = useDailyTask();
  const { list: templates, isLoading } = useDailyTemplatesWithStepCount();
  const { delete: deleteTemplate, isDeleting } = useDailyTemplates();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null);
  const [applyHariHDate, setApplyHariHDate] = useState<Date | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const stepsTemplateId = selectedTemplate?.id ?? expandedTemplateId ?? null;
  const { steps: viewedSteps, isLoading: stepsLoading } = useDailyTemplateSteps(stepsTemplateId);
  const hasHariHSteps = viewedSteps.some((s) => s.schedule_type != null);

  const handleOpenApply = (template: { id: string; name: string }) => {
    setSelectedTemplate(template);
    setApplyHariHDate(null);
  };

  const handleApplyTemplate = async () => {
    if (!organizationId || !selectedTemplate) return;
    if (hasHariHSteps && !applyHariHDate) {
      toast({
        title: t('common.error') ?? 'Error',
        description: t('dailyTask.template.hariHRequiredWhenApply') ?? 'Pilih tanggal Hari H untuk template ini.',
        variant: 'destructive',
      });
      return;
    }
    setApplyingId(selectedTemplate.id);
    try {
      await applyDailyTemplateToTask({
        taskId,
        dailyTemplateId: selectedTemplate.id,
        organizationId,
        createdByUserId: user?.id ?? null,
        hariHDate: hasHariHSteps && applyHariHDate
          ? (() => {
              const d = applyHariHDate;
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            })()
          : null,
      });
      toast({ title: t('common.success') ?? 'Success', description: t('dailyTask.template.applied') ?? 'Template applied to task.' });
      onSuccess?.();
      await refetchTasks();
      setSelectedTemplate(null);
      setApplyHariHDate(null);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        title: t('common.error') ?? 'Error',
        description: (err as Error)?.message ?? t('dailyTask.template.applyFailed') ?? 'Failed to apply template.',
        variant: 'destructive',
      });
    } finally {
      setApplyingId(null);
    }
  };

  const handleBackFromApply = () => {
    setSelectedTemplate(null);
    setApplyHariHDate(null);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
  };

  const handleEditSuccess = () => {
    setEditTemplateId(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast({ title: t('common.success') ?? 'Success', description: t('dailyTask.template.deleted') ?? 'Template deleted.', variant: 'default' });
      if (expandedTemplateId === id) setExpandedTemplateId(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error') ?? 'Error', description: (err as Error)?.message ?? 'Failed to delete.', variant: 'destructive' });
    }
  };

  const scheduleLabel = (type: DailyTemplateScheduleType | null, value: number | null) => {
    if (!type) return '';
    if (type === 'hari_h') return t('dailyTask.template.hariH') ?? 'Hari H';
    const v = value ?? 0;
    if (type === 'days_before_h') return `${v} hari sebelum H`;
    return `${v} hari kerja setelah H`;
  };

  const showDialogOpen = open && !createModalOpen && !editTemplateId;

  return (
    <>
      {open && (
        <Dialog
          open={showDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleBackFromApply();
              if (!createModalOpen && !editTemplateId) onOpenChange(false);
            }
          }}
        >
          <DialogContent className="w-[min(42rem,95vw,90vh)] h-[min(42rem,95vw,90vh)] max-w-none max-h-none overflow-hidden flex flex-col rounded-lg duration-300">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              {t('dailyTask.template.addTemplate') ?? 'Add Template'}
            </DialogTitle>
            <DialogDescription>
              {t('dailyTask.template.addTemplateDescription') ?? 'Choose a template to add all its steps to this task. One template per task.'}
              {taskTitle && (
                <span className="block mt-1 font-medium text-foreground">{taskTitle}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate ? (
            <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll space-y-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleBackFromApply} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t('common.back') ?? 'Back'}
              </Button>
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <h4 className="text-sm font-medium">{t('dailyTask.template.applyTemplate') ?? 'Apply template'}: {selectedTemplate.name}</h4>
                {hasHariHSteps && (
                  <div className="grid gap-2">
                    <Label>{t('dailyTask.template.hariH') ?? 'Hari H'} *</Label>
                    <CustomDatePicker
                      selected={applyHariHDate ?? undefined}
                      onSelect={(date) => setApplyHariHDate(date)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('dailyTask.template.hariHApplyHint') ?? 'Pilih tanggal Hari H untuk menghitung deadline setiap step.'}
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleApplyTemplate}
                  disabled={applyingId !== null || (hasHariHSteps && !applyHariHDate)}
                >
                  {applyingId === selectedTemplate.id ? (t('common.applying') ?? 'Applying...') : (t('dailyTask.template.addTemplate') ?? 'Add Template')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 py-2">
                <span className="text-sm text-muted-foreground">{t('dailyTask.template.templates') ?? 'Templates'}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll">
                {isLoading ? (
                  <div className="py-8 text-center text-muted-foreground">{t('common.loading') ?? 'Loading...'}</div>
                ) : templates.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>{t('dailyTask.template.noTemplates') ?? 'No templates yet.'}</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {templates.map((template) => {
                      const isExpanded = expandedTemplateId === template.id;
                      const stepsForRow = isExpanded ? viewedSteps : [];
                      return (
                        <li key={template.id} className="rounded-lg border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                            <button
                              type="button"
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                              onClick={() => setExpandedTemplateId((prev) => (prev === template.id ? null : template.id))}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0">
                                <span className="font-medium">{template.name}</span>
                                <span className="ml-2 text-sm text-muted-foreground">
                                  ({template.steps_count} {t('dailyTask.template.steps') ?? 'steps'})
                                </span>
                              </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => { e.stopPropagation(); setEditTemplateId(template.id); }}
                                    disabled={!!applyingId}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('dailyTask.template.editTemplate') ?? 'Edit'}</TooltipContent>
                              </Tooltip>
                              <AlertDialog open={deleteConfirmId === template.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(template.id); }}
                                      disabled={!!applyingId || isDeleting}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('dailyTask.template.deleteTemplate') ?? 'Delete'}</TooltipContent>
                                </Tooltip>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t('dailyTask.template.deleteTemplate') ?? 'Delete'}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('dailyTask.template.deleteTemplateConfirm') ?? 'Delete this template? All its steps will be removed.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t('common.cancel') ?? 'Cancel'}</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => template.id && handleDeleteTemplate(template.id)}
                                    >
                                      {t('dailyTask.template.deleteTemplate') ?? 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleOpenApply({ id: template.id, name: template.name }); }}
                                disabled={applyingId !== null}
                              >
                                {t('dailyTask.template.addTemplate') ?? 'Add Template'}
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t bg-muted/20 px-4 py-3">
                              {stepsLoading ? (
                                <div className="text-sm text-muted-foreground py-2">{t('common.loading') ?? 'Loading...'}</div>
                              ) : stepsForRow.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-2">{t('dailyTask.template.noStepsYet') ?? 'No steps yet.'}</div>
                              ) : (
                                <ul className="space-y-1.5">
                                  {stepsForRow.map((step, idx) => (
                                    <li key={step.id} className="text-sm flex items-start gap-2">
                                      <span className="font-medium text-muted-foreground shrink-0">{idx + 1}.</span>
                                      <span className="font-medium">{step.title}</span>
                                      {(step.schedule_type != null || (step.step_priority != null)) && (
                                        <span className="text-muted-foreground">
                                          {step.schedule_type != null
                                            ? `(${scheduleLabel(step.schedule_type, step.schedule_value)})`
                                            : `(${t('dailyTask.template.priority') ?? 'Prioritas'} ${step.step_priority})`}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      )}
      <CreateDailyTemplateModal
        open={createModalOpen || !!editTemplateId}
        onOpenChange={(open) => {
          if (!open) { setCreateModalOpen(false); setEditTemplateId(null); }
        }}
        templateId={editTemplateId ?? undefined}
        onSuccess={() => { handleCreateSuccess(); handleEditSuccess(); }}
      />
    </>
  );
}

