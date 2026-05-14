import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Calendar, ChevronDown } from 'lucide-react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { CrmAssigneeSegment } from '@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom';
import { useCrmFirstResponsePerRoom } from '@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom';
import type {
  ConversationSummaryChannelKey,
  ConversationSummaryPeriodKey,
} from '@/5-3-dashboard/components/crm/crmConversationSummaryMetrics';
import {
  aggregateCrmDashboardFromCohorts,
  filterCrmRowsLikeFirstResponseTable,
  filterCrmRowsLikeResolutionTable,
  filterRowsByCrmAssigneeSegments,
  formatDurationHMS,
} from '@/5-3-dashboard/components/crm/crmPerformancePerTimeMetrics';

function periodRangeLabel(period: ConversationSummaryPeriodKey): string {
  const end = new Date();
  if (period === 'all') return 'All time';
  const days = Number(period);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return `${format(start, 'd MMM yyyy', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`;
}

function periodMenuLabel(key: ConversationSummaryPeriodKey): string {
  if (key === 'all') return 'All time';
  return `Last ${key} days (${periodRangeLabel(key)})`;
}

/**
 * CRM dashboard: response / resolution averages from the same RPC as the per-room tables
 * (`get_crm_first_response_time_per_room`), with matching period rules — first card uses
 * `cycle_started_at` window; resolution & post-first-reply metrics use `resolved_at` window
 * (same as {@link CrmResolutionPerRoomSection}). Search text in tables is not applied here.
 */
type MetricRoleToggles = { admin: boolean; supervisor: boolean; agent: boolean };

function roleSegmentsFromToggles(t: MetricRoleToggles): ReadonlySet<CrmAssigneeSegment> | null {
  const s = new Set<CrmAssigneeSegment>();
  if (t.admin) s.add('admin');
  if (t.supervisor) s.add('supervisor');
  if (t.agent) s.add('agent');
  return s.size === 0 ? null : s;
}

export function CrmPerformancePerTimeSection() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { organizationId } = useCurrentOrg();
  const { data: crmRows = [], isError: isCrmError, isPending: crmPending } = useCrmFirstResponsePerRoom(organizationId);
  const [period, setPeriod] = useState<ConversationSummaryPeriodKey>('7');
  const [channel, setChannel] = useState<ConversationSummaryChannelKey>('all');
  const [metricRoleToggles, setMetricRoleToggles] = useState<MetricRoleToggles>({
    admin: true,
    supervisor: true,
    agent: true,
  });

  const firstTableCohort = useMemo(
    () => filterCrmRowsLikeFirstResponseTable(crmRows, period, channel),
    [crmRows, period, channel],
  );

  const resolutionTableCohort = useMemo(
    () => filterCrmRowsLikeResolutionTable(crmRows, period, channel),
    [crmRows, period, channel],
  );

  const roleSegmentsForMetrics = useMemo(() => roleSegmentsFromToggles(metricRoleToggles), [metricRoleToggles]);

  const firstForRoleMetrics = useMemo(
    () => filterRowsByCrmAssigneeSegments(firstTableCohort, roleSegmentsForMetrics),
    [firstTableCohort, roleSegmentsForMetrics],
  );

  const resolutionForRoleHandleMetrics = useMemo(
    () => filterRowsByCrmAssigneeSegments(resolutionTableCohort, roleSegmentsForMetrics),
    [resolutionTableCohort, roleSegmentsForMetrics],
  );

  const agg = useMemo(
    () =>
      aggregateCrmDashboardFromCohorts(
        firstForRoleMetrics,
        resolutionTableCohort,
        resolutionForRoleHandleMetrics,
      ),
    [firstForRoleMetrics, resolutionTableCohort, resolutionForRoleHandleMetrics],
  );

  const roleFilterMenu = (
    <>
      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {t('crm.performance.roleFilterHeading', 'Include assignee roles')}
      </p>
      <DropdownMenuCheckboxItem
        checked={metricRoleToggles.admin}
        onCheckedChange={(v) => setMetricRoleToggles((prev) => ({ ...prev, admin: Boolean(v) }))}
        onSelect={(e) => e.preventDefault()}
      >
        {t('crm.performance.roleAdmin', 'Admin & owner')}
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={metricRoleToggles.supervisor}
        onCheckedChange={(v) => setMetricRoleToggles((prev) => ({ ...prev, supervisor: Boolean(v) }))}
        onSelect={(e) => e.preventDefault()}
      >
        {t('crm.performance.roleSupervisor', 'Supervisor')}
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={metricRoleToggles.agent}
        onCheckedChange={(v) => setMetricRoleToggles((prev) => ({ ...prev, agent: Boolean(v) }))}
        onSelect={(e) => e.preventDefault()}
      >
        {t('crm.performance.roleAgent', 'Agent')}
      </DropdownMenuCheckboxItem>
    </>
  );

  if (!organizationId) {
    return null;
  }

  const goLivechat = () => {
    void navigate('/omnichannel/livechat');
  };

  return (
    <section
      className="min-w-0 max-w-full space-y-4 rounded-lg border border-surface-border bg-card p-4 shadow-sm"
      aria-labelledby="crm-performance-per-time-heading"
    >
      <div className="flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="crm-performance-per-time-heading" className="text-lg font-semibold text-foreground">
            Performance per time
          </h2>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
              'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
            )}
          >
            Real time
          </span>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <Select value={period} onValueChange={(v) => setPeriod(v as ConversationSummaryPeriodKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 flex-1 text-left text-xs sm:min-w-[220px] sm:text-sm">
              <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{periodMenuLabel('7')}</SelectItem>
              <SelectItem value="30">{periodMenuLabel('30')}</SelectItem>
              <SelectItem value="90">{periodMenuLabel('90')}</SelectItem>
              <SelectItem value="all">{periodMenuLabel('all')}</SelectItem>
            </SelectContent>
          </Select>

          <div
            className="flex h-9 w-full min-w-0 flex-1 items-center rounded-md border border-input bg-muted/30 px-3 text-xs text-muted-foreground sm:min-w-[140px] sm:text-sm"
            title="Division filter coming soon"
          >
            All divisions
          </div>

          <Select value={channel} onValueChange={(v) => setChannel(v as ConversationSummaryChannelKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 flex-1 text-left text-xs sm:min-w-[140px] sm:text-sm">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!crmPending && crmRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-200 bg-amber-50/90 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
          <span className="font-medium">Belum ada data room.</span> Metrik ini memakai{' '}
          <span className="font-mono">get_crm_first_response_time_per_room</span> (satu baris siklus terbaru per room,
          WA/IG/email). Lead murni website tanpa room tercatat tidak muncul — itu normal. Coba perluas ke{' '}
          <span className="font-medium">Semua periode</span> atau pastikan ada percakapan dengan siklus.
        </p>
      ) : null}

      {!crmPending &&
      crmRows.length > 0 &&
      firstTableCohort.length === 0 &&
      resolutionTableCohort.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Ada {crmRows.length} room di org, tetapi tidak ada yang masuk filter periode/channel saat ini (periode first
          reply memakai <span className="font-medium">mulai siklus</span>; resolusi memakai{' '}
          <span className="font-medium">waktu resolve</span>). Ubah periode atau channel.
        </p>
      ) : null}

      {isCrmError ? (
        <p className="text-sm text-destructive">Could not load CRM metrics. Try again later.</p>
      ) : null}

      {crmPending ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="mt-3 h-9 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard
            label="Average first response time"
            value={formatDurationHMS(agg.avgFirstResponseMs)}
            onFilterBy={goLivechat}
            roleFilterMenu={roleFilterMenu}
          />
          <MetricCard
            label="Average resolution time"
            value={formatDurationHMS(agg.avgResolutionMs)}
            onFilterBy={goLivechat}
          />
          <MetricCard
            label="Average response time"
            value={formatDurationHMS(agg.avgResponseAfterFirstMs)}
            onFilterBy={goLivechat}
            badgeNew
            roleFilterMenu={roleFilterMenu}
          />
        </div>
      )}
    </section>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  onFilterBy: () => void;
  badgeNew?: boolean;
  roleFilterMenu?: ReactNode;
}) {
  const { label, value, onFilterBy, badgeNew, roleFilterMenu } = props;
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badgeNew ? (
          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
            New
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs font-medium text-brand-blue">
            Filter by
            <ChevronDown className="ml-0.5 h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {roleFilterMenu ? (
            <>
              {roleFilterMenu}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={onFilterBy}>Open live chat</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
