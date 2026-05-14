import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  useCreateOrganizationSlaPolicy,
  useDeleteOrganizationSlaPolicy,
  useOrganizationSlaPolicies,
  useOrganizationSlaWorkSchedule,
  useSetOrganizationSlaPolicyStatus,
  useUpdateOrganizationSlaPolicy,
  useUpsertOrganizationSlaWorkSchedule,
  type OrganizationSlaPolicyRow,
} from '@/5-3-dashboard/hooks/useOrganizationSlaPolicies';
import { SlaPolicyForm } from '@/5-3-dashboard/omnichannel-settings/components/sla/SlaPolicyForm';
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from '@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader';

type View = 'list' | 'create' | 'edit';

const DEFAULT_WEEKLY_RULES = [
  { dow: 1, open: '09:00', close: '17:00' },
  { dow: 2, open: '09:00', close: '17:00' },
  { dow: 3, open: '09:00', close: '17:00' },
  { dow: 4, open: '09:00', close: '17:00' },
  { dow: 5, open: '09:00', close: '17:00' },
];

export function SlaManagementSection() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const canEdit = isOwner || isAdmin;
  const [view, setView] = useState<View>('list');
  const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [hoursFilter, setHoursFilter] = useState<'all' | '24x7' | 'business_hours'>('all');
  const [search, setSearch] = useState('');

  const { data: policies = [], isPending } = useOrganizationSlaPolicies(organizationId);
  const { data: workSchedule } = useOrganizationSlaWorkSchedule(organizationId);
  const upsertSchedule = useUpsertOrganizationSlaWorkSchedule();
  const createPolicy = useCreateOrganizationSlaPolicy();
  const updatePolicy = useUpdateOrganizationSlaPolicy();
  const setStatus = useSetOrganizationSlaPolicyStatus();
  const deletePolicy = useDeleteOrganizationSlaPolicy();

  const filtered = useMemo(() => {
    let rows = policies;
    if (statusFilter !== 'all') {
      rows = rows.filter((p) => p.status === statusFilter);
    }
    if (hoursFilter !== 'all') {
      rows = rows.filter((p) => p.operational_hours_profile === hoursFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return rows;
  }, [policies, statusFilter, hoursFilter, search]);

  const editRow = useMemo(
    () => (editPolicyId ? policies.find((p) => p.id === editPolicyId) ?? null : null),
    [editPolicyId, policies],
  );

  const ensureWorkSchedule = useCallback(async (): Promise<string | null> => {
    if (!organizationId) return null;
    if (workSchedule?.id) return workSchedule.id;
    const id = await upsertSchedule.mutateAsync({
      organizationId,
      timezone: 'Asia/Jakarta',
      weekly_rules: DEFAULT_WEEKLY_RULES,
    });
    return id;
  }, [organizationId, workSchedule?.id, upsertSchedule]);

  const handleSaveForm = useCallback(
    async (payload: {
      name: string;
      description: string;
      status: 'active' | 'inactive';
      priority: number;
      first_response_sla_minutes: number;
      resolution_sla_minutes: number;
      inter_reply_sla_minutes: number | null;
      operational_hours_profile: '24x7' | 'business_hours';
      conditions: Array<{ field: 'channel'; operator: 'eq'; value: string }>;
    }) => {
      if (!organizationId || !canEdit) {
        toast.error(t('omnichannel.slaManagement.forbidden'));
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        toast.error(t('omnichannel.slaManagement.saveFailed'));
        return;
      }
      let workScheduleId: string | null = workSchedule?.id ?? null;
      if (payload.operational_hours_profile === 'business_hours') {
        workScheduleId = await ensureWorkSchedule();
      } else {
        workScheduleId = null;
      }
      try {
        if (view === 'create') {
          await createPolicy.mutateAsync({
            organizationId,
            userId: uid,
            work_schedule_id: workScheduleId,
            ...payload,
          });
          toast.success(t('omnichannel.slaManagement.created'));
        } else if (view === 'edit' && editPolicyId) {
          await updatePolicy.mutateAsync({
            organizationId,
            policyId: editPolicyId,
            userId: uid,
            work_schedule_id: workScheduleId,
            ...payload,
          });
          toast.success(t('omnichannel.slaManagement.updated'));
        }
        setView('list');
        setEditPolicyId(null);
      } catch {
        toast.error(t('omnichannel.slaManagement.saveFailed'));
      }
    },
    [
      organizationId,
      canEdit,
      view,
      editPolicyId,
      createPolicy,
      updatePolicy,
      workSchedule?.id,
      ensureWorkSchedule,
      t,
    ],
  );

  const startEdit = (p: OrganizationSlaPolicyRow) => {
    setEditPolicyId(p.id);
    setView('edit');
  };

  const toggle = async (p: OrganizationSlaPolicyRow) => {
    if (!organizationId || !canEdit) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    const next = p.status === 'active' ? 'inactive' : 'active';
    try {
      await setStatus.mutateAsync({ organizationId, policyId: p.id, status: next, userId: uid });
      toast.success(t('omnichannel.slaManagement.statusUpdated'));
    } catch {
      toast.error(t('omnichannel.slaManagement.saveFailed'));
    }
  };

  const remove = async (p: OrganizationSlaPolicyRow) => {
    if (!organizationId || !canEdit) return;
    if (policies.length <= 1) {
      toast.error(t('omnichannel.slaManagement.cannotDeleteLast'));
      return;
    }
    if (!window.confirm(t('omnichannel.slaManagement.confirmDelete', { name: p.name }))) return;
    try {
      await deletePolicy.mutateAsync({ organizationId, policyId: p.id });
      toast.success(t('omnichannel.slaManagement.deleted'));
    } catch {
      toast.error(t('omnichannel.slaManagement.saveFailed'));
    }
  };

  if (!organizationId) {
    return <p className="p-4 text-sm text-muted-foreground">{t('omnichannel.slaManagement.noOrg')}</p>;
  }

  if (view === 'create' || view === 'edit') {
    return (
      <SlaPolicyForm
        mode={view}
        initial={editRow}
        canEdit={canEdit}
        onCancel={() => {
          setView('list');
          setEditPolicyId(null);
        }}
        onSave={handleSaveForm}
        isSaving={createPolicy.isPending || updatePolicy.isPending}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
        <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
          <div>
            <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>{t('omnichannel.slaManagement.pageTitle')}</h2>
            <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>{t('omnichannel.slaManagement.intro')}</p>
          </div>
          {canEdit ? (
            <Button type="button" className="shrink-0" onClick={() => setView('create')}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {t('omnichannel.slaManagement.createPolicy')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-hide flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">{t('omnichannel.slaManagement.readOnly')}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t('omnichannel.slaManagement.filterStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('omnichannel.slaManagement.statusAll')}</SelectItem>
              <SelectItem value="active">{t('omnichannel.slaManagement.statusActive')}</SelectItem>
              <SelectItem value="inactive">{t('omnichannel.slaManagement.statusInactive')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={hoursFilter} onValueChange={(v) => setHoursFilter(v as typeof hoursFilter)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('omnichannel.slaManagement.filterHours')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('omnichannel.slaManagement.hoursAll')}</SelectItem>
              <SelectItem value="24x7">{t('omnichannel.slaManagement.hours24')}</SelectItem>
              <SelectItem value="business_hours">{t('omnichannel.slaManagement.hoursBusiness')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:min-w-[200px] sm:max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="pl-8"
              placeholder={t('omnichannel.slaManagement.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <FolderOpen className="h-14 w-14 text-muted-foreground" aria-hidden />
            <p className="text-base font-medium text-foreground">{t('omnichannel.slaManagement.emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('omnichannel.slaManagement.emptyHint')}</p>
            {canEdit ? (
              <Button type="button" onClick={() => setView('create')}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t('omnichannel.slaManagement.createPolicy')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('omnichannel.slaManagement.colName')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colStatus')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colFirst')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colResolution')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colInterReply')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colHours')}</TableHead>
                  <TableHead>{t('omnichannel.slaManagement.colConditions')}</TableHead>
                  <TableHead className="text-right">{t('omnichannel.slaManagement.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[12rem] font-medium">{p.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs capitalize">{p.status}</TableCell>
                    <TableCell className="text-xs">{p.first_response_sla_minutes}</TableCell>
                    <TableCell className="text-xs">{p.resolution_sla_minutes}</TableCell>
                    <TableCell className="text-xs">{p.inter_reply_sla_minutes ?? '—'}</TableCell>
                    <TableCell className="text-xs">{p.operational_hours_profile}</TableCell>
                    <TableCell className="text-xs">{(p.organization_sla_policy_conditions ?? []).length}</TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEdit(p)}>
                            {t('omnichannel.slaManagement.edit')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void toggle(p)}>
                            {p.status === 'active'
                              ? t('omnichannel.slaManagement.deactivate')
                              : t('omnichannel.slaManagement.activate')}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => void remove(p)}>
                            {t('omnichannel.slaManagement.delete')}
                          </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
