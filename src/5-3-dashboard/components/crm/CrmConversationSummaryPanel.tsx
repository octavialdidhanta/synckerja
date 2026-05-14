import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { useLeads } from '@/shared/hooks/organized/sales';
import { isResolvedStatus } from '@/5-3-whatsapp/constants/leadStatus';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import {
  leadMatchesSummaryChannel,
  leadWithinSummaryPeriod,
  type ConversationSummaryChannelKey,
  type ConversationSummaryPeriodKey,
} from '@/5-3-dashboard/components/crm/crmConversationSummaryMetrics';

function hasAssignee(lead: Record<string, unknown>): boolean {
  if (lead.assignee_id) return true;
  const a = String(lead.assignee ?? '')
    .trim()
    .toLowerCase();
  return a.length > 0 && a !== 'unassigned';
}

function isResolvedConversation(lead: { lead_status?: { name?: string } | null }): boolean {
  const name = lead.lead_status?.name;
  if (isResolvedStatus(name)) return true;
  const lower = String(name ?? '').toLowerCase();
  return lower === 'converted';
}

function metricCardClass() {
  return cn('rounded-lg border border-border bg-card p-3 shadow-sm');
}

/**
 * Sidebar metrics for `/omnichannel/crm` — mirrors “Conversation summary” style (filters + three KPI cards).
 * Uses `useLeads({ scope: 'all' })` so counts match the main CRM dashboard: all leads in the active org allowed by RLS,
 * not the default per-user `mine` scope.
 */
export function CrmConversationSummaryPanel() {
  const navigate = useNavigate();
  const { leads } = useLeads({ scope: 'all' });
  const [period, setPeriod] = useState<ConversationSummaryPeriodKey>('7');
  const [channel, setChannel] = useState<ConversationSummaryChannelKey>('all');

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          leadWithinSummaryPeriod(l as Record<string, unknown>, period) &&
          leadMatchesSummaryChannel(l as Record<string, unknown>, channel),
      ),
    [leads, period, channel],
  );

  const unassigned = useMemo(
    () => filtered.filter((l) => !hasAssignee(l as Record<string, unknown>)).length,
    [filtered],
  );
  const assigned = useMemo(
    () => filtered.filter((l) => hasAssignee(l as Record<string, unknown>)).length,
    [filtered],
  );
  const resolved = useMemo(() => filtered.filter((l) => isResolvedConversation(l)).length, [filtered]);

  const periodLabel = useMemo(() => {
    const end = new Date();
    if (period === 'all') return 'Semua periode';
    const days = Number(period);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    return `${days} hari terakhir (${format(start, 'd MMM yyyy', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })})`;
  }, [period]);

  const goLeads = () => {
    void navigate('/omnichannel/leads');
  };

  return (
    <div className="box-border flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm">
      <div className="shrink-0 space-y-3 border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-start min-[400px]:justify-between">
          <h2 className="text-base font-semibold leading-tight text-foreground">Ringkasan percakapan</h2>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <Select value={period} onValueChange={(v) => setPeriod(v as ConversationSummaryPeriodKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 flex-1 text-left text-xs sm:min-w-[160px] sm:text-sm">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 hari terakhir</SelectItem>
              <SelectItem value="30">30 hari terakhir</SelectItem>
              <SelectItem value="90">90 hari terakhir</SelectItem>
              <SelectItem value="all">Semua periode</SelectItem>
            </SelectContent>
          </Select>

          <div
            className="flex h-9 w-full min-w-0 flex-1 items-center rounded-md border border-input bg-muted/30 px-3 text-xs text-muted-foreground sm:min-w-[140px] sm:text-sm"
            title="Filter divisi akan menyusul"
          >
            Semua divisi
          </div>

          <Select value={channel} onValueChange={(v) => setChannel(v as ConversationSummaryChannelKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 flex-1 text-left text-xs sm:min-w-[140px] sm:text-sm">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua channel</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>
      </div>

      <div className="grid min-h-0 w-full min-w-0 grid-cols-1 gap-2 overflow-y-auto p-3 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid-cols-3 sm:p-4">
        <div className={cn(metricCardClass(), 'min-w-0')}>
          <p className="text-xs text-muted-foreground">Percakapan belum ditugaskan</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{unassigned}</p>
        </div>

        <div className={cn(metricCardClass(), 'min-w-0')}>
          <p className="text-xs text-muted-foreground">Percakapan ditugaskan</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{assigned}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="link" className="mt-1 h-auto p-0 text-xs font-medium text-brand-blue">
                Filter
                <ChevronDown className="ml-0.5 h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={goLeads}>Buka daftar Leads</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={cn(metricCardClass(), 'min-w-0')}>
          <p className="text-xs text-muted-foreground">Percakapan selesai</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{resolved}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="link" className="mt-1 h-auto p-0 text-xs font-medium text-brand-blue">
                Filter
                <ChevronDown className="ml-0.5 h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={goLeads}>Buka daftar Leads</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
