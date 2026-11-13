import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { cn } from "@/shared/lib/utils";
import {
  CHAIN_LEVELS,
  chainFilterActive,
  chainOptions,
  ideaCode,
  jakartaMonth,
  parseRunLog,
  rowFitsChain,
  runReason,
  setChainLevel,
  shiftMonth,
  summarizeRows,
  type ChainFilter,
  type ChainLevel,
  type IdeaChain,
  type RunLogPlan,
  type RunLogRow,
} from "./runLog";

export const RUN_LOG_KEY = "ai-employee-run-log";

type StatusFilter = "all" | "succeeded" | "failed" | "deferred";
type SourceFilter = "all" | "manual" | "schedule" | "job";

function useRunLog(employeeId: string, month: string) {
  return useQuery({
    queryKey: [RUN_LOG_KEY, employeeId, month],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_employee_run_log", {
        p_employee_id: employeeId,
        p_month: `${month}-01`,
      });
      if (error) throw error;
      return parseRunLog(data);
    },
  });
}

function statusGroup(status: string): StatusFilter | "running" {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "returned") return "failed";
  if (status === "running") return "running";
  return "deferred";
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const group = statusGroup(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        group === "succeeded" && "bg-green-100 text-green-800",
        group === "failed" && "bg-red-100 text-red-800",
        group === "deferred" && "bg-amber-100 text-amber-800",
        group === "running" && "bg-blue-100 text-blue-800",
      )}
    >
      {label}
    </span>
  );
}

function ChainList({ chain, pillarName }: { chain: IdeaChain | null; pillarName: string }) {
  const { t } = useAppTranslation();
  const lines: Array<[string, string]> = [
    [t("aiEmployee.log.master", "Master Thought"), chain?.master?.statement ?? ""],
    [t("aiEmployee.log.bigThought", "Big Thought"), [chain?.bigThought?.code, chain?.bigThought?.statement].filter(Boolean).join(" · ")],
    [t("aiEmployee.log.territory", "Territory"), [chain?.territory?.code, chain?.territory?.statement].filter(Boolean).join(" · ")],
    [t("aiEmployee.log.angle", "Angle"), [chain?.angle?.code, chain?.angle?.statement].filter(Boolean).join(" · ")],
    [t("aiEmployee.log.idea", "Idea"), [chain?.idea?.code, chain?.idea?.statement].filter(Boolean).join(" · ")],
    [t("aiEmployee.log.pillar", "Pilar"), pillarName],
  ];
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
      {lines.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{value || "—"}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function canvaLabel(plan: RunLogPlan | undefined, t: (key: string, fallback: string) => string): { text: string; tone: string } {
  const canva = plan?.canva;
  if (!plan) return { text: "—", tone: "" };
  if (!canva) return { text: t("aiEmployee.log.canva.none", "Belum dibuat"), tone: "text-muted-foreground" };
  if (canva.status === "failed") return { text: t("aiEmployee.log.canva.failed", "Gagal"), tone: "text-red-700" };
  if (canva.status !== "succeeded") return { text: t("aiEmployee.log.canva.running", "Diproses"), tone: "text-blue-700" };
  if (!canva.imagesReady) return { text: t("aiEmployee.log.canva.exporting", "Ekspor gambar"), tone: "text-blue-700" };
  return {
    text: canva.logoPlaced
      ? t("aiEmployee.log.canva.readyLogo", "Jadi · logo")
      : t("aiEmployee.log.canva.ready", "Jadi"),
    tone: "text-green-700",
  };
}

export function AiEmployeeRunLog({ employeeId }: { employeeId: string }) {
  const { t, dateLocale } = useAppTranslation();
  const [month, setMonth] = useState(() => jakartaMonth());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<ChainFilter>({});
  const query = useRunLog(employeeId, month);
  const log = query.data;
  const thisMonth = jakartaMonth();

  const rows = useMemo(() => (log?.rows ?? []).filter((row) => {
    if (statusFilter !== "all" && statusGroup(row.status) !== statusFilter) return false;
    if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
    return rowFitsChain(row, chainFilter);
  }), [log, statusFilter, sourceFilter, chainFilter]);
  const filtered = statusFilter !== "all" || sourceFilter !== "all" || chainFilterActive(chainFilter);
  const levelLabels: Record<ChainLevel, string> = {
    master: t("aiEmployee.log.master", "Master Thought"),
    bigThought: t("aiEmployee.log.bigThought", "Big Thought"),
    territory: t("aiEmployee.log.territory", "Territory"),
    angle: t("aiEmployee.log.angle", "Angle"),
    idea: t("aiEmployee.log.idea", "Idea"),
  };
  // Choices of each level come from the runs of this month under the levels chosen above it.
  const levelOptions = useMemo(
    () => Object.fromEntries(CHAIN_LEVELS.map((level) => [level, chainOptions(log?.rows ?? [], chainFilter, level)])) as Record<ChainLevel, ReturnType<typeof chainOptions>>,
    [log, chainFilter],
  );
  const changeMonth = (step: number) => {
    setMonth((value) => shiftMonth(value, step));
    setChainFilter({});
    setOpenRow(null);
  };

  const monthLabel = useMemo(() => {
    const [year, value] = month.split("-").map(Number);
    return new Date(Date.UTC(year, value - 1, 15)).toLocaleDateString(dateLocale, { month: "long", year: "numeric", timeZone: "UTC" });
  }, [month, dateLocale]);

  const when = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(dateLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  };
  const duration = (row: RunLogRow) => {
    if (!row.startedAt || !row.finishedAt) return "";
    const seconds = Math.round((new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime()) / 1000);
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  };
  const statusLabel = (status: string) => {
    const group = statusGroup(status);
    if (group === "succeeded") return t("aiEmployee.log.status.succeeded", "Berhasil");
    if (group === "failed") return t("aiEmployee.log.status.failed", "Gagal");
    if (group === "running") return t("aiEmployee.log.status.running", "Berjalan");
    return t("aiEmployee.log.status.deferred", "Ditunda");
  };
  const sourceLabel = (row: RunLogRow) => {
    if (row.source === "manual") return t("aiEmployee.log.source.manual", "Generate sekarang");
    if (row.source === "schedule") return t("aiEmployee.log.source.schedule", "Terjadwal");
    if (row.source === "job") {
      return row.sopCode === "SOP3"
        ? t("aiEmployee.log.source.revision", "Revisi")
        : t("aiEmployee.log.source.job", "Tugas");
    }
    return "—";
  };

  // The numbers follow the filters, so a Master Thought or Angle can be judged on its own.
  const summary = log ? (filtered ? summarizeRows(rows) : log.summary) : undefined;
  const chips: Array<[string, number, string]> = summary
    ? [
      [t("aiEmployee.log.summary.runs", "Run"), summary.runs, ""],
      [t("aiEmployee.log.summary.succeeded", "Berhasil"), summary.succeeded, "text-green-700"],
      [t("aiEmployee.log.summary.failed", "Gagal"), summary.failed, "text-red-700"],
      [t("aiEmployee.log.summary.deferred", "Ditunda"), summary.deferred, "text-amber-700"],
      [t("aiEmployee.log.summary.plans", "Plan dibuat"), summary.plans, ""],
      [t("aiEmployee.log.summary.ideas", "Idea dipakai"), summary.uniqueIdeas, ""],
    ]
    : [];

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("aiEmployee.log.title", "Log")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => changeMonth(-1)} aria-label={t("aiEmployee.log.prevMonth", "Bulan sebelumnya")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[8.5rem] text-center text-sm">{monthLabel}</span>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={month >= thisMonth} onClick={() => changeMonth(1)} aria-label={t("aiEmployee.log.nextMonth", "Bulan berikutnya")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="h-8 w-[9rem] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("aiEmployee.log.filter.allStatus", "Semua status")}</SelectItem>
              <SelectItem value="succeeded">{t("aiEmployee.log.status.succeeded", "Berhasil")}</SelectItem>
              <SelectItem value="failed">{t("aiEmployee.log.status.failed", "Gagal")}</SelectItem>
              <SelectItem value="deferred">{t("aiEmployee.log.status.deferred", "Ditunda")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
            <SelectTrigger className="h-8 w-[10.5rem] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("aiEmployee.log.filter.allSource", "Semua sumber")}</SelectItem>
              <SelectItem value="manual">{t("aiEmployee.log.source.manual", "Generate sekarang")}</SelectItem>
              <SelectItem value="schedule">{t("aiEmployee.log.source.schedule", "Terjadwal")}</SelectItem>
              <SelectItem value="job">{t("aiEmployee.log.source.job", "Tugas")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CHAIN_LEVELS.map((level, index) => {
          const parent = index > 0 ? CHAIN_LEVELS[index - 1] : null;
          const options = levelOptions[level];
          const value = chainFilter[level] ?? "all";
          return (
            <div key={level} className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted-foreground">{levelLabels[level]}</span>
              <Select
                value={value}
                disabled={options.length === 0 && value === "all"}
                onValueChange={(next) => setChainFilter((current) => setChainLevel(current, level, next === "all" ? "" : next))}
              >
                <SelectTrigger className="h-8 min-w-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-w-[28rem]">
                  <SelectItem value="all">
                    {parent && chainFilter[parent]
                      ? t("aiEmployee.log.filter.allUnder", "Semua di bawahnya")
                      : t("aiEmployee.log.filter.all", "Semua")}
                  </SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <span className="block max-w-[24rem] truncate">{option.label} ({option.runs})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      {chainFilterActive(chainFilter) ? (
        <div className="-mt-1 mb-3">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setChainFilter({})}>
            {t("aiEmployee.log.filter.clearChain", "Hapus filter Master Thought sampai Idea")}
          </Button>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {chips.map(([label, value, tone]) => (
            <div key={label} className="rounded-md border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={cn("text-lg font-semibold", tone)}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("aiEmployee.log.loading", "Memuat log...")}
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <span>{t("aiEmployee.log.error", "Log belum bisa dimuat.")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("aiEmployee.page.retry", "Muat ulang")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {filtered
            ? t("aiEmployee.log.emptyFiltered", "Tidak ada run yang cocok dengan filter ini.")
            : t("aiEmployee.log.empty", "Belum ada run di bulan ini.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{t("aiEmployee.log.col.time", "Waktu")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.source", "Sumber")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.status", "Status")}</TableHead>
                <TableHead className="min-w-[14rem]">{t("aiEmployee.log.col.reason", "Alasan")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.idea", "Angle · Idea")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.ideaMonth", "Idea bulan ini")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.pillar", "Pilar")}</TableHead>
                <TableHead className="min-w-[14rem]">{t("aiEmployee.log.col.plan", "Plan")}</TableHead>
                <TableHead>{t("aiEmployee.log.col.canva", "Canva")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const plan = row.plans[0];
                // A run without a plan shows the idea and pillar it was working on.
                const chain = plan?.chain ?? row.attempt?.chain ?? null;
                const pillarName = plan?.pillarName || row.attempt?.pillarName || "";
                const fromAttempt = !plan && Boolean(row.attempt);
                const canva = canvaLabel(plan, t);
                const open = openRow === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpenRow(open ? null : row.id)}>
                      <TableCell className="w-8 align-top">
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">
                        <div>{when(row.startedAt)}</div>
                        <div className="text-xs text-muted-foreground">{duration(row)}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">{sourceLabel(row)}</TableCell>
                      <TableCell className="align-top"><StatusPill status={row.status} label={statusLabel(row.status)} /></TableCell>
                      <TableCell className="align-top text-sm">{runReason(row, t)}</TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">
                        {ideaCode(chain) || "—"}
                        {fromAttempt ? <div className="text-xs text-muted-foreground">{t("aiEmployee.log.attempted", "dicoba")}</div> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">
                        {plan?.chain?.idea ? `${plan.ideaMonthCount}×` : "—"}
                      </TableCell>
                      <TableCell className="align-top text-sm">{pillarName || "—"}</TableCell>
                      <TableCell className="align-top text-sm">
                        {plan ? plan.title || "—" : "—"}
                        {row.plans.length > 1 ? (
                          <span className="ml-1 text-xs text-muted-foreground">+{row.plans.length - 1}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className={cn("whitespace-nowrap align-top text-sm", canva.tone)}>{canva.text}</TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={9} className="py-3">
                          <div className="flex flex-col gap-4">
                            {row.plans.length > 0 ? row.plans.map((item) => (
                              <div key={item.id} className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-medium">{item.title || "—"}</span>
                                  {item.chain?.idea ? (
                                    <span className="text-xs text-muted-foreground">
                                      {t("aiEmployee.log.ideaMonthLong", "Idea ini sudah {{count}}× bulan ini").replace("{{count}}", String(item.ideaMonthCount))}
                                    </span>
                                  ) : null}
                                  {item.canva?.designUrl ? (
                                    <a
                                      href={item.canva.designUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {t("aiEmployee.log.openCanva", "Buka di Canva")}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : null}
                                  {item.canva?.error ? <span className="text-xs text-red-700">{item.canva.error}</span> : null}
                                </div>
                                <ChainList chain={item.chain} pillarName={item.pillarName} />
                              </div>
                            )) : row.attempt ? (
                              <div className="flex flex-col gap-2">
                                <span className="text-sm font-medium">{t("aiEmployee.log.lastAttempt", "Terakhir dicoba")}</span>
                                <ChainList chain={row.attempt.chain} pillarName={row.attempt.pillarName} />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {t("aiEmployee.log.noAttempt", "Run ini tidak mencatat ide yang dicoba.")}
                              </p>
                            )}
                            {row.note ? (
                              <p className="font-mono text-[11px] text-muted-foreground">{row.note}</p>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
