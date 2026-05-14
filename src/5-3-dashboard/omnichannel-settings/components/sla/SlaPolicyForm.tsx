import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from 'lucide-react';
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
import type { OrganizationSlaPolicyRow } from '@/5-3-dashboard/hooks/useOrganizationSlaPolicies';

export type SlaPolicyFormPayload = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  priority: number;
  first_response_sla_minutes: number;
  resolution_sla_minutes: number;
  inter_reply_sla_minutes: number | null;
  operational_hours_profile: '24x7' | 'business_hours';
  conditions: Array<{ field: 'channel'; operator: 'eq'; value: string }>;
};

type ConditionRow = { id: string; value: string };

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', labelKey: 'omnichannel.slaManagement.channelWhatsapp' },
  { value: 'instagram', labelKey: 'omnichannel.slaManagement.channelInstagram' },
  { value: 'email', labelKey: 'omnichannel.slaManagement.channelEmail' },
];

function newRow(): ConditionRow {
  return { id: crypto.randomUUID(), value: 'whatsapp' };
}

type Props = {
  mode: 'create' | 'edit';
  initial: OrganizationSlaPolicyRow | null;
  canEdit: boolean;
  onCancel: () => void;
  onSave: (payload: SlaPolicyFormPayload) => void | Promise<void>;
  isSaving: boolean;
};

export function SlaPolicyForm({ mode, initial, canEdit, onCancel, onSave, isSaving }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [priority, setPriority] = useState(10);
  const [firstMin, setFirstMin] = useState('15');
  const [resMin, setResMin] = useState('1440');
  const [interMin, setInterMin] = useState('');
  const [hoursProfile, setHoursProfile] = useState<'24x7' | 'business_hours'>('24x7');
  const [conditionRows, setConditionRows] = useState<ConditionRow[]>([]);

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setName(initial.name);
      setDescription(initial.description ?? '');
      setStatus(initial.status);
      setPriority(initial.priority);
      setFirstMin(String(initial.first_response_sla_minutes));
      setResMin(String(initial.resolution_sla_minutes));
      setInterMin(initial.inter_reply_sla_minutes != null ? String(initial.inter_reply_sla_minutes) : '');
      setHoursProfile(initial.operational_hours_profile);
      const conds = initial.organization_sla_policy_conditions ?? [];
      if (conds.length > 0) {
        setConditionRows(conds.map((c) => ({ id: c.id, value: c.value })));
      } else {
        setConditionRows([]);
      }
    } else {
      setName('');
      setDescription('');
      setStatus('active');
      setPriority(10);
      setFirstMin('15');
      setResMin('1440');
      setInterMin('');
      setHoursProfile('24x7');
      setConditionRows([]);
    }
  }, [mode, initial]);

  const addCondition = () => setConditionRows((r) => [...r, newRow()]);
  const removeCondition = (id: string) => setConditionRows((r) => r.filter((x) => x.id !== id));
  const setConditionValue = (id: string, value: string) =>
    setConditionRows((r) => r.map((x) => (x.id === id ? { ...x, value } : x)));

  const submit = () => {
    if (!canEdit) return;
    const fr = Math.floor(Number(firstMin));
    const rr = Math.floor(Number(resMin));
    const ir = interMin.trim() === '' ? null : Math.floor(Number(interMin));
    if (!name.trim()) {
      return;
    }
    if (!Number.isFinite(fr) || fr < 1 || !Number.isFinite(rr) || rr < 1) {
      return;
    }
    if (ir != null && (!Number.isFinite(ir) || ir < 1)) {
      return;
    }
    const conditions = conditionRows.map((row) => ({
      field: 'channel' as const,
      operator: 'eq' as const,
      value: row.value,
    }));
    void onSave({
      name: name.trim().slice(0, 120),
      description: description.trim().slice(0, 500),
      status,
      priority,
      first_response_sla_minutes: fr,
      resolution_sla_minutes: rr,
      inter_reply_sla_minutes: ir,
      operational_hours_profile: hoursProfile,
      conditions,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'create' ? t('omnichannel.slaManagement.formCreateTitle') : t('omnichannel.slaManagement.formEditTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('omnichannel.slaManagement.formSubtitle')}</p>
      </div>

      <div className="scrollbar-hide flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="sla-pol-name">{t('omnichannel.slaManagement.policyName')}</Label>
          <Input
            id="sla-pol-name"
            maxLength={120}
            disabled={!canEdit}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('omnichannel.slaManagement.policyNamePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sla-pol-desc">{t('omnichannel.slaManagement.policyDesc')}</Label>
          <Textarea
            id="sla-pol-desc"
            maxLength={500}
            rows={3}
            disabled={!canEdit}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('omnichannel.slaManagement.policyDescPlaceholder')}
          />
        </div>

        {mode === 'edit' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('omnichannel.slaManagement.policyStatus')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('omnichannel.slaManagement.statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('omnichannel.slaManagement.statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla-pol-prio">{t('omnichannel.slaManagement.priority')}</Label>
              <Input
                id="sla-pol-prio"
                type="number"
                min={0}
                disabled={!canEdit}
                value={String(priority)}
                onChange={(e) => setPriority(Math.floor(Number(e.target.value)) || 0)}
              />
              <p className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.priorityHint')}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('omnichannel.slaManagement.sectionConditions')}</h3>
            <p className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.sectionConditionsHelp')}</p>
          </div>
          <p className="text-sm font-medium">{t('omnichannel.slaManagement.conditionOrIntro')}</p>
          {conditionRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.noConditionsHint')}</p>
          ) : (
            <div className="space-y-2">
              {conditionRows.map((row, idx) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  {idx > 0 ? (
                    <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto">{t('omnichannel.slaManagement.or')}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.fieldChannel')}</span>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{t('omnichannel.slaManagement.opIs')}</span>
                  <Select value={row.value} onValueChange={(v) => setConditionValue(row.id, v)} disabled={!canEdit}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canEdit ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(row.id)} aria-label="Remove">
                      <Minus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={addCondition}>
              <Plus className="mr-2 h-4 w-4" />
              {t('omnichannel.slaManagement.addCondition')}
            </Button>
          ) : null}
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{t('omnichannel.slaManagement.sectionTargets')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sla-pol-fr">{t('omnichannel.slaManagement.targetFirst')}</Label>
              <Input
                id="sla-pol-fr"
                type="number"
                min={1}
                disabled={!canEdit}
                value={firstMin}
                onChange={(e) => setFirstMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla-pol-ir">{t('omnichannel.slaManagement.targetInter')}</Label>
              <Input
                id="sla-pol-ir"
                type="number"
                min={1}
                disabled={!canEdit}
                value={interMin}
                onChange={(e) => setInterMin(e.target.value)}
                placeholder={t('omnichannel.slaManagement.optional')}
              />
              <p className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.targetInterHelp')}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sla-pol-res">{t('omnichannel.slaManagement.targetResolution')}</Label>
              <Input
                id="sla-pol-res"
                type="number"
                min={1}
                disabled={!canEdit}
                value={resMin}
                onChange={(e) => setResMin(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('omnichannel.slaManagement.operationalHours')}</Label>
            <Select value={hoursProfile} onValueChange={(v) => setHoursProfile(v as '24x7' | 'business_hours')} disabled={!canEdit}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24x7">{t('omnichannel.slaManagement.hours24')}</SelectItem>
                <SelectItem value="business_hours">{t('omnichannel.slaManagement.hoursBusiness')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('omnichannel.slaManagement.operationalHoursHelp')}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {t('omnichannel.slaManagement.cancel')}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={() => void submit()} disabled={isSaving || !name.trim()}>
              {t('omnichannel.slaManagement.save')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
