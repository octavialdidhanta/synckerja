import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useSaveToPlan, type NewPlanData } from '../hooks/useSaveToPlan';
import { parseAIScriptMetadata } from '../utils/parseAIScriptOutput';
import { dedupeMasterRowsByNamePreferOrg } from '../utils/dedupeMasterRowsByNamePreferOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { InfoTooltip } from '@/2-1-employees/MyInfo/LeavePermit/components/info-tooltip';
import { ContentCalendarPlanPicker, type PlanForPicker } from './ContentCalendarPlanPicker';
import { SaveToPlanPreviewDialog } from './SaveToPlanPreviewDialog';
import { format } from 'date-fns';
import { CalendarIcon, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

interface FormDataForPlan {
  content_type_id?: string;
  service_id?: string;
  sub_service_id?: string;
  content_pillar_id?: string;
}

interface SaveToPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  script: string;
  formDataForPlan?: FormDataForPlan | null;
  onSuccess?: () => void;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string;
  employee_status_id?: string | null;
  employee_status_name?: string | null;
  pending_removal?: boolean | null;
}

export const SaveToPlanModal: React.FC<SaveToPlanModalProps> = ({
  isOpen,
  onClose,
  script,
  formDataForPlan,
  onSuccess,
}) => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const { saveToPlan, isSaving } = useSaveToPlan();

  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [planMode, setPlanMode] = useState<'existing' | 'new'>('new');
  const [selectedPlan, setSelectedPlan] = useState<PlanForPicker | null>(null);
  const [saveBrief, setSaveBrief] = useState(true);
  const [saveCaption, setSaveCaption] = useState(true);
  const [saveConcept, setSaveConcept] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Create new plan form state
  const [newPlanForm, setNewPlanForm] = useState({
    title: '',
    pic_id: '',
    content_type_id: '',
    service_id: '',
    sub_service_id: '',
    content_pillar_id: '',
  });

  // Master data for create new form
  const [contentTypes, setContentTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [subServices, setSubServices] = useState<any[]>([]);
  const [contentPillars, setContentPillars] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  const loadMasterData = useCallback(async () => {
    if (!organizationId) return;
    setMasterLoading(true);
    setMasterError(null);
    try {
      const [ct, svc, sub, cp, emp, statuses] = await Promise.all([
        supabase.from('content_types').select('*').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('services').select('*').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('sub_services').select('*').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('content_pillars').select('*').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('employees').select('id, full_name, user_id, employee_status_id, pending_removal').eq('organization_id', organizationId).order('full_name'),
        supabase.from('employee_statuses').select('id, name'),
      ]);
      if (ct.error) throw ct.error;
      if (svc.error) throw svc.error;
      if (sub.error) throw sub.error;
      if (cp.error) throw cp.error;
      if (emp.error) throw emp.error;
      if (statuses.error) throw statuses.error;
      setContentTypes(ct.data || []);
      setServices(svc.data || []);
      setSubServices(sub.data || []);
      setContentPillars(dedupeMasterRowsByNamePreferOrg(cp.data || [], organizationId));
      const statusNameById = new Map((statuses.data || []).map((status) => [status.id, status.name]));
      const activeEmployees = ((emp.data || []) as Employee[])
        .map((employee) => ({
          ...employee,
          employee_status_name: employee.employee_status_id ? statusNameById.get(employee.employee_status_id) || null : null
        }))
        .filter((employee) => isEmployeeActive(employee));
      setEmployees(activeEmployees);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data';
      setMasterError(msg);
      toast.error(t('scriptGenerator.saveToPlanModal.errorLoadMaster', 'Gagal memuat data. Tutup modal dan coba lagi.'));
    } finally {
      setMasterLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      setPlanMode('new');
      setSelectedPlan(null);
      setSaveBrief(true);
      setSaveCaption(true);
      setSaveConcept(true);
      const { title, contentTypeName, contentPillarName } = parseAIScriptMetadata(
        script,
        contentTypes.map((ct: { name: string }) => ct.name),
        contentPillars.map((cp: { name: string }) => cp.name)
      );
      // Prefer form data from Script Generator; fallback to parsed metadata from script
      const contentTypeId = formDataForPlan?.content_type_id
        || (contentTypeName ? contentTypes.find((ct: { name: string }) => ct.name.toLowerCase() === contentTypeName.toLowerCase())?.id : '')
        || '';
      const serviceId = formDataForPlan?.service_id || '';
      const subServiceId = formDataForPlan?.sub_service_id || '';
      const contentPillarId = formDataForPlan?.content_pillar_id
        || (contentPillarName ? contentPillars.find((cp: { name: string }) => cp.name.toLowerCase() === contentPillarName.toLowerCase())?.id : '')
        || '';
      setNewPlanForm({
        title: title || '',
        pic_id: (currentEmployee as unknown as Employee | null)?.id ?? '',
        content_type_id: contentTypeId,
        service_id: serviceId,
        sub_service_id: subServiceId,
        content_pillar_id: contentPillarId,
      });
    }
  }, [isOpen, script, formDataForPlan, contentTypes, contentPillars, (currentEmployee as unknown as Employee | null)?.id]);

  useEffect(() => {
    if (isOpen && planMode === 'new' && organizationId) {
      loadMasterData();
    }
  }, [isOpen, planMode, organizationId, loadMasterData]);

  useEffect(() => {
    if ((currentEmployee as unknown as Employee | null)?.id && planMode === 'new' && !newPlanForm.pic_id) {
      setNewPlanForm((prev) => ({ ...prev, pic_id: (currentEmployee as unknown as Employee).id }));
    }
  }, [(currentEmployee as unknown as Employee | null)?.id, planMode, newPlanForm.pic_id]);

  // Content type auto-fill from AI script (only when content_type_id is empty)
  useEffect(() => {
    if (!isOpen || planMode !== 'new' || contentTypes.length === 0 || !script?.trim()) return;
    const { contentTypeName } = parseAIScriptMetadata(
      script,
      contentTypes.map((ct: { name: string }) => ct.name),
      contentPillars.map((cp: { name: string }) => cp.name)
    );
    if (!contentTypeName) return;
    const matched = contentTypes.find((ct: { name: string }) => ct.name.toLowerCase() === contentTypeName.toLowerCase());
    if (matched) {
      setNewPlanForm((prev) => (prev.content_type_id ? prev : { ...prev, content_type_id: matched.id }));
    }
  }, [isOpen, planMode, contentTypes, contentPillars, script]);

  // Content pillar auto-fill from AI script (only when content_pillar_id is empty)
  useEffect(() => {
    if (!isOpen || planMode !== 'new' || contentPillars.length === 0 || !script?.trim()) return;
    const { contentPillarName } = parseAIScriptMetadata(
      script,
      contentTypes.map((ct: { name: string }) => ct.name),
      contentPillars.map((cp: { name: string }) => cp.name)
    );
    if (!contentPillarName) return;
    const matched = contentPillars.find((cp: { name: string }) => cp.name.toLowerCase() === contentPillarName.toLowerCase());
    if (matched) {
      setNewPlanForm((prev) => (prev.content_pillar_id ? prev : { ...prev, content_pillar_id: matched.id }));
    }
  }, [isOpen, planMode, contentTypes, contentPillars, script]);

  const filteredSubServices = subServices.filter((s) => s.service_id === newPlanForm.service_id);

  // Apply sub_service_id from formDataForPlan when subServices loads (handles async load timing)
  useEffect(() => {
    if (!isOpen || planMode !== 'new' || masterLoading || subServices.length === 0) return;
    const subId = formDataForPlan?.sub_service_id;
    const serviceId = formDataForPlan?.service_id;
    if (!subId || !serviceId) return;
    const subBelongsToService = subServices.some(
      (s) => s.id === subId && s.service_id === serviceId
    );
    if (subBelongsToService) {
      setNewPlanForm((prev) => (prev.sub_service_id === subId ? prev : { ...prev, sub_service_id: subId }));
    }
  }, [isOpen, planMode, masterLoading, subServices, formDataForPlan?.sub_service_id, formDataForPlan?.service_id]);

  // Clear sub_service_id only when current sub_service doesn't belong to selected service
  // (when user manually changes service, not on initial auto-fill)
  useEffect(() => {
    if (!newPlanForm.service_id || !newPlanForm.sub_service_id || subServices.length === 0) return;
    const subBelongsToService = subServices.some(
      (s) => s.id === newPlanForm.sub_service_id && s.service_id === newPlanForm.service_id
    );
    if (!subBelongsToService) {
      setNewPlanForm((prev) => ({ ...prev, sub_service_id: '' }));
    }
  }, [newPlanForm.service_id, newPlanForm.sub_service_id, subServices]);

  const handlePickerSelect = (plan: PlanForPicker) => {
    setSelectedPlan(plan);
    if (plan.post_date) {
      setSelectedDate(format(new Date(plan.post_date), 'yyyy-MM-dd'));
    }
    setShowPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveBrief && !saveCaption && !saveConcept) return;

    if (planMode === 'existing') {
      if (!selectedPlan) return;
      const success = await saveToPlan({
        script,
        planId: selectedPlan.id,
        postDate: selectedPlan.post_date ? format(new Date(selectedPlan.post_date), 'yyyy-MM-dd') : selectedDate,
        saveBrief,
        saveCaption,
        saveConcept,
      });
      if (success) {
        onSuccess?.();
        onClose();
      }
      return;
    }

    // Create new plan
    const newPlanData: NewPlanData = {
      title: newPlanForm.title.trim(),
      pic_id: newPlanForm.pic_id,
      content_type_id: newPlanForm.content_type_id,
      service_id: newPlanForm.service_id,
      sub_service_id: newPlanForm.sub_service_id,
      content_pillar_id: newPlanForm.content_pillar_id,
    };

    const success = await saveToPlan({
      script,
      planId: 'new',
      postDate: selectedDate,
      saveBrief,
      saveCaption,
      saveConcept,
      newPlanData,
    });

    if (success) {
      onSuccess?.();
      onClose();
    }
  };

  const canSubmit =
    (saveBrief || saveCaption || saveConcept) &&
    (planMode === 'existing' ? !!selectedPlan : !!(
      !masterError &&
      newPlanForm.title.trim() &&
      newPlanForm.pic_id &&
      newPlanForm.content_type_id &&
      newPlanForm.service_id &&
      newPlanForm.sub_service_id &&
      newPlanForm.content_pillar_id
    ));

  const LabelWithTooltip = ({
    htmlFor,
    label,
    tooltip,
    children,
  }: {
    htmlFor?: string;
    label: string;
    tooltip: string;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <InfoTooltip content={tooltip} />
      {children}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[min(90vw,680px)] sm:max-h-[min(90vh,680px)] flex flex-col overflow-hidden" style={{ zIndex: 999998 }}>
          <DialogHeader>
            <DialogTitle>{t('scriptGenerator.saveToPlanModal.title', 'Save to Plan')}</DialogTitle>
            <DialogDescription>
              {t('scriptGenerator.saveToPlanModal.description', 'Select publish date and target plan to save Breakdown Script and/or Caption.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain space-y-4 py-2">
              {/* 1. Tanggal Publish */}
              <div className="space-y-2">
                <LabelWithTooltip
                  htmlFor="post-date"
                  label={t('scriptGenerator.saveToPlanModal.selectDate', 'Publish Date')}
                  tooltip={t('scriptGenerator.saveToPlanModal.tooltipDate', 'Content publish date')}
                />
                <input
                  id="post-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* 2. Target Plan */}
              <div className="space-y-2">
                <LabelWithTooltip
                  label={t('scriptGenerator.saveToPlanModal.selectPlan', 'Target Plan')}
                  tooltip={t('scriptGenerator.saveToPlanModal.tooltipPlan', 'Target plan to save Brief/Caption')}
                />
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="planMode"
                      checked={planMode === 'existing'}
                      onChange={() => setPlanMode('existing')}
                      className="rounded-full"
                    />
                    <span className="text-sm">{t('scriptGenerator.saveToPlanModal.selectExisting', 'Select existing plan')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="planMode"
                      checked={planMode === 'new'}
                      onChange={() => setPlanMode('new')}
                      className="rounded-full"
                    />
                    <span className="text-sm">{t('scriptGenerator.saveToPlanModal.createNew', 'Create new plan')}</span>
                  </label>
                </div>

                {planMode === 'existing' && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPicker(true)}
                      className="gap-2"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {t('scriptGenerator.saveToPlanModal.pickFromCalendar', 'Pick from Content Calendar')}
                    </Button>
                    {selectedPlan && (
                      <div className="rounded-md border p-3 text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.postDate', 'Post Date')}:</span>
                          <span>{selectedPlan.post_date ? format(new Date(selectedPlan.post_date), 'dd MMM yyyy') : '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.pic', 'PIC')}:</span>
                          <span>{selectedPlan.pic?.full_name ?? '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.contentType', 'Content Type')}:</span>
                          <span>{selectedPlan.content_type?.name ?? '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.service', 'Service')}:</span>
                          <span>{selectedPlan.service?.name ?? '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.subService', 'Sub Service')}:</span>
                          <span>{selectedPlan.sub_service?.name ?? '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.titleField', 'Title')}:</span>
                          <span className="font-medium">{selectedPlan.title?.trim() || '-'}</span>
                          <span className="text-muted-foreground">{t('scriptGenerator.saveToPlanModal.contentPillar', 'Content Pillar')}:</span>
                          <span>{selectedPlan.content_pillar?.name ?? '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {planMode === 'new' && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    {masterError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {masterError}
                      </div>
                    )}
                    {masterLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.titleField', 'Title')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipTitle', 'Content plan title')} />
                          <Input
                            value={newPlanForm.title}
                            onChange={(e) => setNewPlanForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder={t('scriptGenerator.saveToPlanModal.titleField', 'Title')}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.pic', 'PIC')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipPic', 'PIC for this plan')} />
                          <Select
                            value={newPlanForm.pic_id}
                            onValueChange={(v) => setNewPlanForm((p) => ({ ...p, pic_id: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder={t('scriptGenerator.saveToPlanModal.pic', 'PIC')} /></SelectTrigger>
                            <SelectContent>
                              {employees.map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.contentType', 'Content Type')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipContentType', 'Content type')} />
                          <Select
                            value={newPlanForm.content_type_id}
                            onValueChange={(v) => setNewPlanForm((p) => ({ ...p, content_type_id: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder={t('scriptGenerator.saveToPlanModal.contentType', 'Content Type')} /></SelectTrigger>
                            <SelectContent>
                              {contentTypes.map((ct) => (
                                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.service', 'Service')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipService', 'Related service')} />
                          <Select
                            value={newPlanForm.service_id}
                            onValueChange={(v) => setNewPlanForm((p) => ({ ...p, service_id: v, sub_service_id: '' }))}
                          >
                            <SelectTrigger><SelectValue placeholder={t('scriptGenerator.saveToPlanModal.service', 'Service')} /></SelectTrigger>
                            <SelectContent>
                              {services.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.subService', 'Sub Service')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipSubService', 'Sub service')} />
                          <Select
                            value={newPlanForm.sub_service_id}
                            onValueChange={(v) => setNewPlanForm((p) => ({ ...p, sub_service_id: v }))}
                            disabled={!newPlanForm.service_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={newPlanForm.service_id ? t('scriptGenerator.saveToPlanModal.subService', 'Sub Service') : t('scriptGenerator.saveToPlanModal.selectServiceFirst', 'Select service first')} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredSubServices.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <LabelWithTooltip label={t('scriptGenerator.saveToPlanModal.contentPillar', 'Content Pillar')} tooltip={t('scriptGenerator.saveToPlanModal.tooltipContentPillar', 'Content pillar')} />
                          <Select
                            value={newPlanForm.content_pillar_id}
                            onValueChange={(v) => setNewPlanForm((p) => ({ ...p, content_pillar_id: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder={t('scriptGenerator.saveToPlanModal.contentPillar', 'Content Pillar')} /></SelectTrigger>
                            <SelectContent>
                              {contentPillars.map((cp) => (
                                <SelectItem key={cp.id} value={cp.id}>
                                  <div className="flex items-center gap-2">
                                    {cp.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cp.color }} />}
                                    {cp.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Simpan section */}
              <div className="space-y-3">
                <LabelWithTooltip
                  label={t('scriptGenerator.saveToPlanModal.saveSection', 'Save section')}
                  tooltip={t('scriptGenerator.saveToPlanModal.tooltipPlan', 'Target plan to save Brief/Caption')}
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-brief"
                      checked={saveBrief}
                      onCheckedChange={(v) => setSaveBrief(v === true)}
                    />
                    <Label htmlFor="save-brief" className="flex items-center gap-1.5 cursor-pointer font-normal">
                      {t('scriptGenerator.saveToPlanModal.saveBrief', 'Save Breakdown Script to Brief')}
                      <InfoTooltip content={t('scriptGenerator.saveToPlanModal.tooltipBrief', 'Save Breakdown Script to plan Brief field')} />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-caption"
                      checked={saveCaption}
                      onCheckedChange={(v) => setSaveCaption(v === true)}
                    />
                    <Label htmlFor="save-caption" className="flex items-center gap-1.5 cursor-pointer font-normal">
                      {t('scriptGenerator.saveToPlanModal.saveCaption', 'Save Caption')}
                      <InfoTooltip content={t('scriptGenerator.saveToPlanModal.tooltipCaption', 'Save Caption to plan')} />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-concept"
                      checked={saveConcept}
                      onCheckedChange={(v) => setSaveConcept(v === true)}
                    />
                    <Label htmlFor="save-concept" className="flex items-center gap-1.5 cursor-pointer font-normal">
                      {t('scriptGenerator.saveToPlanModal.saveConcept', 'Save Concept')}
                      <InfoTooltip content={t('scriptGenerator.saveToPlanModal.tooltipConcept', 'Save Concept to dashboard section Concept')} />
                    </Label>
                  </div>
                </div>
              </div>

              {/* Preview button */}
              {(saveBrief || saveCaption || saveConcept) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {t('scriptGenerator.saveToPlanModal.viewPreview', 'View preview')}
                </Button>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || !canSubmit}>
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ContentCalendarPlanPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onSelect={handlePickerSelect}
      />

      <SaveToPlanPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        script={script}
        saveBrief={saveBrief}
        saveCaption={saveCaption}
        saveConcept={saveConcept}
      />
    </>
  );
};
