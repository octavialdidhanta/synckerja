import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Search,
} from 'lucide-react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatSlaStatusLabel } from '@/5-3-dashboard/components/crm/formatSlaStatusLabel';
import type { CrmFirstResponseRoomRow } from '@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom';
import { useCrmFirstResponsePerRoom } from '@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom';
import type {
  ConversationSummaryChannelKey,
  ConversationSummaryPeriodKey,
} from '@/5-3-dashboard/components/crm/crmConversationSummaryMetrics';
import {
  cycleStartedAtWithinPeriod,
  conversationChannelMatches,
} from '@/5-3-dashboard/components/crm/crmPerformancePerTimeMetrics';

type SortCol =
  | 'conversation_id'
  | 'customer_display'
  | 'assignee_name'
  | 'channel'
  | 'sla_first_reply_status'
  | 'sla_inter_reply_status'
  | 'cycle_started_at'
  | 'assignment_due_at'
  | 'first_response_at';

function displayChannel(ch: string): string {
  const x = String(ch).trim().toLowerCase();
  if (x === 'whatsapp') return 'wa_cloud';
  if (x === 'facebook' || x === 'messenger') return 'messenger';
  if (x === 'email') return 'email';
  return ch;
}

function formatCellTs(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return '—';
  const d = parseISO(String(iso));
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy, HH:mm', { locale: localeId });
}

function exportRowsCsv(rows: CrmFirstResponseRoomRow[]) {
  const headers = [
    'Room ID',
    'Customer ID',
    'Agent',
    'Channel',
    'SLA first reply (status)',
    'SLA first reply late (min)',
    'SLA inter-reply (status)',
    'SLA inter-reply late (min)',
    'Assignment date',
    'Assignment due',
    'First response time',
    'Resolution time',
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.conversation_id,
        r.customer_display,
        r.assignee_name,
        displayChannel(r.channel),
        r.sla_first_reply_status ?? '',
        r.sla_first_reply_late_minutes != null ? String(r.sla_first_reply_late_minutes) : '',
        r.sla_inter_reply_status ?? '',
        r.sla_inter_reply_late_minutes != null ? String(r.sla_inter_reply_late_minutes) : '',
        r.cycle_started_at,
        r.assignment_due_at ?? '',
        r.first_response_at ?? '',
        r.resolved_at ?? '',
      ]
        .map((c) => esc(String(c)))
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-first-response-per-room-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function compare(a: string, b: string, dir: 'asc' | 'desc'): number {
  const m = dir === 'asc' ? 1 : -1;
  return a < b ? -m : a > b ? m : 0;
}

/**
 * Table rows from RPC `get_crm_first_response_time_per_room` (latest cycle per conversation in org).
 */
export function CrmFirstResponsePerRoomSection() {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: rows = [], isPending, isError, refetch } = useCrmFirstResponsePerRoom(organizationId);

  const [period, setPeriod] = useState<ConversationSummaryPeriodKey>('7');
  const [channel, setChannel] = useState<ConversationSummaryChannelKey>('all');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({
    col: 'cycle_started_at',
    dir: 'desc',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!cycleStartedAtWithinPeriod(r.cycle_started_at, period)) return false;
      if (!conversationChannelMatches(r.channel, channel)) return false;
      if (!q) return true;
      const hay = [
        r.conversation_id,
        r.customer_display,
        r.assignee_name,
        r.channel,
        displayChannel(r.channel),
        r.sla_first_reply_status ?? '',
        r.sla_first_reply_late_minutes != null ? String(r.sla_first_reply_late_minutes) : '',
        r.sla_inter_reply_status ?? '',
        r.sla_inter_reply_late_minutes != null ? String(r.sla_inter_reply_late_minutes) : '',
        r.assignment_due_at ?? '',
        formatCellTs(r.assignment_due_at),
        r.first_response_at ?? '',
        formatCellTs(r.first_response_at),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, period, channel, search]);

  const sorted = useMemo(() => {
    const { col, dir } = sort;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = String((a as Record<string, unknown>)[col] ?? '');
      const vb = String((b as Record<string, unknown>)[col] ?? '');
      if (col === 'cycle_started_at' || col === 'assignment_due_at' || col === 'first_response_at') {
        const ta = va ? parseISO(va).getTime() : 0;
        const tb = vb ? parseISO(vb).getTime() : 0;
        const na = Number.isNaN(ta) ? 0 : ta;
        const nb = Number.isNaN(tb) ? 0 : tb;
        return dir === 'asc' ? na - nb : nb - na;
      }
      return compare(va.toLowerCase(), vb.toLowerCase(), dir);
    });
    return copy;
  }, [filtered, sort]);

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize));

  const pageRows = useMemo(() => {
    const p = Math.min(page, maxPage);
    const start = (p - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize, maxPage]);

  useEffect(() => {
    setPage((p) => Math.min(p, maxPage));
  }, [maxPage]);

  const toggleSort = (col: SortCol) => {
    setSort((s) =>
      s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' },
    );
  };

  const SortBtn = ({ col, label }: { col: SortCol; label: string }) => {
    const active = sort.col === col;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 h-8 gap-1 px-2 font-medium text-foreground hover:bg-muted/80"
        onClick={() => toggleSort(col)}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </Button>
    );
  };

  if (!organizationId) return null;

  const periodMenuLabel = (key: ConversationSummaryPeriodKey) => {
    if (key === 'all') return 'All time';
    const end = new Date();
    const days = Number(key);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const range = `${format(start, 'd MMM yyyy', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`;
    return `Last ${key} days (${range})`;
  };

  const from = sorted.length === 0 ? 0 : (Math.min(page, maxPage) - 1) * pageSize + 1;
  const to = Math.min(Math.min(page, maxPage) * pageSize, sorted.length);

  return (
    <section
      className="mt-0 min-w-0 max-w-full space-y-3 rounded-lg border border-surface-border bg-card p-4 shadow-sm"
      aria-labelledby="crm-first-response-room-heading"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="crm-first-response-room-heading" className="text-lg font-semibold text-foreground">
            First response time per Room ID
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

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1">
                <Download className="h-4 w-4" aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportRowsCsv(sorted)}>Export CSV (filtered)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Column layout (fixed columns)"
            aria-label="Column layout"
          >
            <Columns2 className="h-4 w-4" />
          </Button>

          <Select value={period} onValueChange={(v) => setPeriod(v as ConversationSummaryPeriodKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 sm:w-[min(100%,260px)]">
              <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{periodMenuLabel('7')}</SelectItem>
              <SelectItem value="30">{periodMenuLabel('30')}</SelectItem>
              <SelectItem value="90">{periodMenuLabel('90')}</SelectItem>
              <SelectItem value="all">{periodMenuLabel('all')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={channel} onValueChange={(v) => setChannel(v as ConversationSummaryChannelKey)}>
            <SelectTrigger className="h-9 w-full min-w-0 sm:w-[140px]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Messenger</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full min-w-0 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-9 pl-8"
              placeholder="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search table"
            />
          </div>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">
          Failed to load table.{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => void refetch()}>
            Retry
          </Button>
        </p>
      ) : null}

      <div className="min-w-0 overflow-x-auto overflow-y-hidden rounded-md border border-border">
        <Table containerClassName="scrollbar-hide max-h-[min(480px,60vh)] min-h-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[20rem] whitespace-nowrap sm:min-w-[22rem]">
                <SortBtn col="conversation_id" label="Room ID" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="customer_display" label="Customer ID" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="assignee_name" label="Agent" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="channel" label="Channel" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="sla_first_reply_status" label={t('crm.sla.colFirstReply', 'First reply SLA')} />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="sla_inter_reply_status" label={t('crm.sla.colInterReply', 'Inter-reply SLA')} />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="cycle_started_at" label="Assignment date" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="assignment_due_at" label="Assignment due" />
              </TableHead>
              <TableHead className="whitespace-nowrap">
                <SortBtn col="first_response_at" label="First response time" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? t('crm.tables.noData', 'Belum ada data.')
                    : t(
                        'crm.tables.noRowsForFilter',
                        'Tidak ada baris untuk filter saat ini.',
                      )}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.conversation_id}>
                  <TableCell className="min-w-[20rem] whitespace-nowrap font-mono text-xs sm:min-w-[22rem]">
                    <Link
                      to={`/omnichannel/livechat?conversation=${encodeURIComponent(r.conversation_id)}`}
                      className="text-brand-blue underline-offset-2 hover:underline"
                    >
                      {r.conversation_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate">{r.customer_display}</TableCell>
                  <TableCell className="max-w-[8rem] truncate">{r.assignee_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{displayChannel(r.channel)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSlaStatusLabel(t, r.sla_first_reply_status, r.sla_first_reply_late_minutes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSlaStatusLabel(t, r.sla_inter_reply_status, r.sla_inter_reply_late_minutes)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatCellTs(r.cycle_started_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatCellTs(r.assignment_due_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatCellTs(r.first_response_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            Showing {sorted.length === 0 ? 0 : from}-{to} of {sorted.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Page</span>
          <Select
            value={String(Math.min(page, maxPage))}
            onValueChange={(v) => setPage(Number(v))}
            disabled={maxPage <= 1}
          >
            <SelectTrigger className="h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: maxPage }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            of {maxPage} page{maxPage === 1 ? '' : 's'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={Math.min(page, maxPage) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={Math.min(page, maxPage) >= maxPage}
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
