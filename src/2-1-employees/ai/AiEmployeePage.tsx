import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useToast } from "@/shared/hooks/use-toast";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { AiEmployeePageSkeleton } from "./AiEmployeePageSkeleton";
import {
  briefChanges,
  classifyAiEmployeeError,
  sameBrief,
  sameRoutine,
  sameSchedule,
} from "./parse";
import type { BriefChange, BriefDraft, CatalogOption, RoutineRow, ScheduleRow } from "./types";
import { useAiEmployeePage } from "./useAiEmployeePage";

const WEEKDAYS = [
  { value: 1, label: "Senin", short: "Sen" },
  { value: 2, label: "Selasa", short: "Sel" },
  { value: 3, label: "Rabu", short: "Rab" },
  { value: 4, label: "Kamis", short: "Kam" },
  { value: 5, label: "Jumat", short: "Jum" },
  { value: 6, label: "Sabtu", short: "Sab" },
  { value: 7, label: "Minggu", short: "Min" },
];

const KR_CODES = ["KR1", "KR2", "KR3", "KR4", "KR5"];

function runningMonthEnd(locale: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 0)));
}

function blankRoutine(
  actionCode: RoutineRow["actionCode"],
  cadence: RoutineRow["cadence"],
  weekday: number | null,
  timeLocal: string,
  reviewerName: string | null,
  weekdays: number[] = [],
): RoutineRow {
  return {
    actionCode,
    cadence,
    weekday,
    weekdays,
    timeLocal,
    isActive: false,
    nextRunAt: null,
    lastSentAt: null,
    lastStatus: null,
    lastError: "",
    reviewerName,
    reviewerEmail: null,
  };
}

function draftRoutines(reviewerName: string | null): RoutineRow[] {
  return [
    blankRoutine("work_report.daily", "days", null, "09:00", reviewerName),
    blankRoutine("work_report.weekly", "weekly", null, "09:00", reviewerName),
    blankRoutine("work_report.monthly", "monthly", null, "09:00", reviewerName),
  ];
}

function blockedReportDay(rows: RoutineRow[]): number | null {
  const weekly = rows.find((row) => row.actionCode === "work_report.weekly");
  return weekly?.isActive && weekly.weekday != null ? weekly.weekday : null;
}

function withoutBlockedDay(rows: RoutineRow[]): RoutineRow[] {
  const blocked = blockedReportDay(rows);
  if (blocked == null) return rows;
  return rows.map((row) => {
    if (row.actionCode !== "work_report.daily") return row;
    const weekdays = (row.weekdays ?? []).filter((day) => day !== blocked);
    return {
      ...row,
      weekdays,
      isActive: weekdays.length === 0 ? false : row.isActive,
    };
  });
}

function mergeReportRoutines(saved: RoutineRow[], reviewerName: string | null): RoutineRow[] {
  return withoutBlockedDay(draftRoutines(reviewerName).map((draft) => saved.find((row) => row.actionCode === draft.actionCode) ?? draft));
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function nameMap(primary: CatalogOption[], extra: CatalogOption[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const item of extra) names.set(item.id, item.label);
  for (const item of primary) names.set(item.id, item.label);
  return names;
}

function formatWhen(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function formatNumber(value: number | null, locale: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

function workName(code: string | null, label: (key: string, fallback: string) => string): string {
  if (code === "SOP1") return label("aiEmployee.work.weeklyPlan", "Content Plan");
  if (code === "SOP2") return label("aiEmployee.work.adHoc", "Menerima dan mengerjakan tugas dadakan");
  if (code === "SOP3") return label("aiEmployee.work.revision", "Merevisi hasil yang ditolak");
  if (code === "CHAT") return label("aiEmployee.work.chat", "Percakapan");
  return code || "—";
}

function MultiSelect({
  label,
  emptyLabel,
  options,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  emptyLabel: string;
  options: CatalogOption[];
  value: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const selected = options.filter((option) => value.includes(option.id));
  const summary = selected.length > 0 ? selected.map((option) => option.label).join(", ") : label;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-auto min-h-9 w-full justify-start px-3 py-2 text-left text-xs font-normal"
        >
          <span className="line-clamp-2">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-80 overflow-y-auto p-2">
        {options.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={value.includes(option.id)}
                disabled={disabled}
                onChange={() => onToggle(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function ChangeTable({ rows }: { rows: BriefChange[] }) {
  return (
    <div className="max-h-[50vh] overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-2 font-medium">Bagian</th>
            <th className="py-2 pr-2 font-medium">Sekarang</th>
            <th className="py-2 font-medium">Menjadi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b align-top last:border-0">
              <td className="py-2 pr-2 font-medium">{row.label}</td>
              <td className="py-2 pr-2 whitespace-pre-wrap text-muted-foreground">{row.before}</td>
              <td className="py-2 whitespace-pre-wrap">{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiEmployeePage() {
  const { employeeId } = useParams();
  const { t, dateLocale } = useAppTranslation();
  const { toast } = useToast();
  const model = useAiEmployeePage(employeeId);
  const showContent = useDebouncedReady(!model.showFullPageSkeleton, 200);
  const [brief, setBrief] = useState<BriefDraft | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [reportRoutines, setReportRoutines] = useState<RoutineRow[]>(() => draftRoutines(null));
  const [copyEmail1, setCopyEmail1] = useState("");
  const [copyEmail2, setCopyEmail2] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const [scheduleCompare, setScheduleCompare] = useState<{ before: ScheduleRow; after: ScheduleRow } | null>(null);
  const [routineCompare, setRoutineCompare] = useState<{ before: RoutineRow | null; after: RoutineRow } | null>(null);
  const [saving, setSaving] = useState(false);
  const page = model.page;
  const pageRef = useRef(page);
  pageRef.current = page;
  const briefKey = page ? JSON.stringify(page.brief) : "";
  const scheduleKey = page ? JSON.stringify(page.schedules) : "";
  const routineKey = page ? JSON.stringify(page.routines) : "";
  const copyKey = page ? `${page.summary.reportCopyEmail1 ?? ""}|${page.summary.reportCopyEmail2 ?? ""}` : "";

  useEffect(() => {
    setBrief(null);
    setSchedules([]);
    setReportRoutines(draftRoutines(null));
    setCopyEmail1("");
    setCopyEmail2("");
    setBriefOpen(false);
    setScheduleCompare(null);
    setRoutineCompare(null);
  }, [employeeId]);

  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    setBrief(current.brief);
  }, [briefKey]);

  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    setSchedules(current.schedules);
  }, [scheduleKey]);

  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    setReportRoutines(mergeReportRoutines(current.routines, current.summary.reviewerName));
  }, [routineKey]);

  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    setCopyEmail1(current.summary.reportCopyEmail1 ?? "");
    setCopyEmail2(current.summary.reportCopyEmail2 ?? "");
  }, [copyKey]);

  const names = useMemo(() => {
    if (!page) {
      return {
        services: new Map<string, string>(),
        personas: new Map<string, string>(),
        pillars: new Map<string, string>(),
        products: new Map<string, string>(),
      };
    }
    return {
      services: nameMap(page.options.services, page.briefLabels.services),
      personas: nameMap(page.options.personas, page.briefLabels.personas),
      pillars: nameMap(page.options.pillars, page.briefLabels.pillars),
      products: nameMap(page.options.products, page.briefLabels.products),
    };
  }, [page]);

  const pendingBrief = page && brief ? briefChanges(page.brief, brief, names) : [];
  const canEdit = Boolean(page?.canEdit);
  const statusLabel = (status: string | null) => {
    if (status === "on_track") return t("aiEmployee.status.onTrack", "Sesuai jalur");
    if (status === "attention") return t("aiEmployee.status.attention", "Perlu perhatian");
    if (status === "coaching") return t("aiEmployee.status.coaching", "Pembinaan");
    if (status === "disabled") return t("aiEmployee.status.disabled", "Dinonaktifkan");
    return status || "—";
  };
  const runStatus = (status: string) => {
    if (status === "succeeded") return t("aiEmployee.run.succeeded", "Berhasil");
    if (status === "failed") return t("aiEmployee.run.failed", "Gagal");
    if (status === "running") return t("aiEmployee.run.running", "Berjalan");
    if (status === "deferred") return t("aiEmployee.run.deferred", "Ditunda");
    if (status === "late") return t("aiEmployee.run.late", "Terlambat");
    if (status === "returned") return t("aiEmployee.run.returned", "Dikembalikan");
    return status;
  };
  const jobStatus = (status: string) => {
    if (status === "queued") return t("aiEmployee.job.queued", "Antre");
    if (status === "claimed") return t("aiEmployee.job.claimed", "Diambil");
    if (status === "running") return t("aiEmployee.job.running", "Berjalan");
    if (status === "done") return t("aiEmployee.job.done", "Selesai");
    if (status === "failed") return t("aiEmployee.job.failed", "Gagal");
    if (status === "deferred") return t("aiEmployee.job.deferred", "Ditunda");
    if (status === "rejected") return t("aiEmployee.job.rejected", "Ditolak");
    return status;
  };
  const failureText = model.failure === "forbidden"
    ? t("aiEmployee.page.forbidden", "Halaman ini hanya untuk owner dan admin organisasi ini.")
    : model.failure === "not_found"
      ? t("aiEmployee.page.notFound", "Karyawan AI tidak ditemukan di organisasi ini.")
      : model.failure
        ? t("aiEmployee.page.loadError", "Halaman karyawan AI gagal dimuat.")
        : null;

  const reportSaveError = (error: unknown) => {
    const kind = classifyAiEmployeeError(error);
    const raw = error instanceof Error ? error.message.toLowerCase() : "";
    const description = raw.includes("invalid_email")
      ? t("aiEmployee.routine.invalidEmail", "Alamat email tidak valid atau sama dengan penerima lain.")
      : raw.includes("schedule_ambiguous")
      ? t("aiEmployee.schedule.ambiguous", "Ada lebih dari satu jadwal untuk SOP ini.")
      : kind === "forbidden"
        ? t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")
        : kind === "not_found"
          ? t("aiEmployee.page.notFound", "Karyawan AI tidak ditemukan di organisasi ini.")
          : kind === "invalid"
            ? t("aiEmployee.page.invalid", "Nilai ditolak. Jam selesai harus setelah jam mulai, dan hari harus 1 sampai 7.")
            : t("aiEmployee.page.saveError", "Perubahan tidak tersimpan.");
    toast({ title: t("aiEmployee.page.saveFailed", "Tidak tersimpan"), description, variant: "destructive" });
  };

  const confirmBrief = async () => {
    if (!brief) return;
    setSaving(true);
    try {
      await model.saveBrief(brief);
      setBriefOpen(false);
      toast({ title: t("aiEmployee.brief.saved", "Brief tersimpan") });
    } catch (error) {
      reportSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmSchedule = async () => {
    if (!scheduleCompare) return;
    setSaving(true);
    try {
      await model.saveSchedule(scheduleCompare.after);
      setScheduleCompare(null);
      toast({ title: t("aiEmployee.schedule.saved", "Jadwal tersimpan") });
    } catch (error) {
      reportSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmRoutine = async () => {
    if (!routineCompare) return;
    setSaving(true);
    try {
      await model.saveRoutine(routineCompare.after);
      setRoutineCompare(null);
      toast({ title: t("aiEmployee.routine.saved", "Rutinitas tersimpan") });
    } catch (error) {
      reportSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const routineStatus = (status: string | null) => {
    if (status === "sent") return t("aiEmployee.routine.sent", "Terkirim");
    if (status === "failed") return t("aiEmployee.routine.failed", "Gagal");
    if (status === "skipped") return t("aiEmployee.routine.skipped", "Dilewati");
    return t("aiEmployee.routine.never", "Belum terkirim");
  };

  const dayName = (value: number | null) => WEEKDAYS.find((item) => item.value === value)?.label ?? "—";

  const cadenceLabel = (row: RoutineRow) => {
    if (row.cadence === "weekly") {
      return t("aiEmployee.routine.weeklyAt", "Setiap {{day}} pukul {{time}}", { day: dayName(row.weekday), time: row.timeLocal });
    }
    if (row.cadence === "monthly") {
      return t("aiEmployee.routine.monthlyAt", "{{date}} pukul {{time}}", { date: runningMonthEnd(dateLocale), time: row.timeLocal });
    }
    const days = (row.weekdays ?? []).map((value) => dayName(value)).join(", ");
    return t("aiEmployee.routine.daysAt", "{{days}} pukul {{time}}", { days: days || "—", time: row.timeLocal });
  };

  const routineTitle = (row: RoutineRow) => {
    if (row.actionCode === "work_report.weekly") return t("aiEmployee.routine.weeklyTitle", "Mingguan");
    if (row.actionCode === "work_report.monthly") return t("aiEmployee.routine.monthlyTitle", "Bulanan");
    return t("aiEmployee.routine.dailyTitle", "Harian");
  };

  const updateRoutine = (actionCode: string, patch: Partial<RoutineRow>) => {
    setReportRoutines((current) => withoutBlockedDay(current.map((row) => row.actionCode === actionCode ? { ...row, ...patch } : row)));
  };

  const confirmCopies = async () => {
    setSaving(true);
    try {
      await model.saveReportCopies(copyEmail1, copyEmail2);
      toast({ title: t("aiEmployee.routine.copiesSaved", "Email tambahan tersimpan") });
    } catch (error) {
      reportSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (sopCode: string, patch: Partial<ScheduleRow>) => {
    setSchedules((current) => current.map((row, index) => {
      const key = `${row.sopCode}-${index}`;
      return key === sopCode ? { ...row, ...patch } : row;
    }));
  };

  const visibleProducts = page && brief
    ? page.options.products.filter((product) => {
      const selected = brief.productIds.includes(product.id);
      const allowed = (product.serviceId != null && brief.serviceIds.includes(product.serviceId))
        || (product.parentServiceId != null && brief.serviceIds.includes(product.parentServiceId));
      return selected || allowed;
    })
    : [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={cn("flex min-h-0 min-w-0 w-full flex-1", !showContent && "pointer-events-none invisible")}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0 px-1 py-3">
                  <Link to="/employees" className="text-xs font-medium text-blue-600 hover:underline">
                    {t("aiEmployee.page.back", "Karyawan")}
                  </Link>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {page?.summary.fullName ?? t("aiEmployee.page.title", "Karyawan AI")}
                  </h1>
                  <p className="text-xs text-gray-500">
                    {page
                      ? `${page.summary.jobTitle || "—"} · ${statusLabel(page.summary.performanceStatus)} · ${page.summary.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif")}`
                      : t("aiEmployee.page.subtitle", "Ringkasan kerja karyawan AI")}
                  </p>
                </div>

                {page && brief ? (
                  <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 items-start gap-2">
                    <div className="col-span-12 flex min-w-0 flex-col gap-2 xl:col-span-8">
                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-2 text-sm font-semibold">{t("aiEmployee.summary.title", "Ringkasan")}</h2>
                        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.summary.name", "Nama")}</dt>
                            <dd>{page.summary.fullName}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.summary.role", "Jabatan")}</dt>
                            <dd>{page.summary.jobTitle || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.summary.reviewer", "Reviewer")}</dt>
                            <dd>{page.summary.reviewerName || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.summary.performance", "Status kinerja")}</dt>
                            <dd>{statusLabel(page.summary.performanceStatus)} · {page.summary.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif")}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-2 text-sm font-semibold">{t("aiEmployee.kpi.title", "KPI periode berjalan")}</h2>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                          {KR_CODES.map((code) => {
                            const item = page.keyResults.find((row) => row.code === code);
                            return (
                              <div key={code} className="rounded-md border border-border p-2">
                                <p className="text-xs font-semibold">{code}</p>
                                <p className="line-clamp-2 text-xs text-muted-foreground">{item?.title || t("aiEmployee.kpi.empty", "Belum ada")}</p>
                                <p className="mt-1 text-sm">
                                  {item ? `${formatNumber(item.currentValue, dateLocale)} / ${formatNumber(item.targetValue, dateLocale)} ${item.unit ?? ""}` : "—"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-2 text-sm font-semibold">{t("aiEmployee.runs.title", "20 log kerja terakhir")}</h2>
                        {page.runs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("aiEmployee.runs.empty", "Belum ada log kerja.")}</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {page.runs.map((run) => (
                              <li key={run.id} className="rounded-md border border-border px-3 py-2 text-sm">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-medium">{workName(run.sopCode, t)}</span>
                                  <span>{runStatus(run.status)}</span>
                                  <span className="text-muted-foreground">{formatWhen(run.startedAt, dateLocale)}</span>
                                  <span>{t("aiEmployee.runs.plans", "{{count}} plan", { count: run.planCount })}</span>
                                </div>
                                {run.note ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{run.note}</p> : null}
                                {run.plans.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {run.plans.map((plan) => (
                                      <Link
                                        key={plan.id}
                                        to={`/digital-marketing/social-media/content-calendar?plan=${plan.id}`}
                                        className="text-xs font-medium text-blue-600 hover:underline"
                                      >
                                        {plan.title || t("aiEmployee.runs.openPlan", "Buka plan")}
                                      </Link>
                                    ))}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-2 text-sm font-semibold">{t("aiEmployee.jobs.title", "Antrean")}</h2>
                        {page.jobs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("aiEmployee.jobs.empty", "Tidak ada job.")}</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {page.jobs.map((job, index) => (
                              <li key={job.id} className={cn("rounded-md border px-3 py-2 text-sm", index === 0 ? "border-blue-200 bg-blue-50/60" : "border-border")}>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-medium">{index === 0 ? t("aiEmployee.jobs.latest", "Job terakhir") : t("aiEmployee.jobs.older", "Job")}</span>
                                  <span>{job.source === "revision" ? t("aiEmployee.jobs.revision", "Revisi") : t("aiEmployee.jobs.task", "Tugas")}</span>
                                  <span>{jobStatus(job.status)}</span>
                                  <span className="text-muted-foreground">{formatWhen(job.createdAt, dateLocale)}</span>
                                </div>
                                {job.reason ? <p className="mt-1 text-xs text-muted-foreground">{job.reason}</p> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>

                    <div className="col-span-12 flex min-w-0 flex-col gap-2 xl:col-span-4">
                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-1 text-sm font-semibold">{t("aiEmployee.quota.title", "Kuota hari ini")}</h2>
                        <p className="text-sm">
                          {page.quota.cap == null
                            ? t("aiEmployee.quota.unknown", "{{used}} terpakai", { used: page.quota.used })
                            : t("aiEmployee.quota.employee", "{{used}} terpakai, {{remaining}} sisa", {
                              used: page.quota.used,
                              remaining: page.quota.remaining ?? 0,
                            })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("aiEmployee.quota.employeeCap", "Batas karyawan {{cap}} · {{date}} WIB", {
                            cap: page.quota.cap ?? "—",
                            date: page.quota.usageDate || "—",
                          })}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("aiEmployee.quota.org", "Batas organisasi: {{used}} terpakai, {{remaining}} sisa dari {{limit}} · {{date}} UTC", {
                            used: page.quota.orgUsed,
                            remaining: page.quota.orgRemaining,
                            limit: page.quota.orgLimit,
                            date: page.quota.orgUsageDate || "—",
                          })}
                        </p>
                      </section>

                      <div className="flex flex-col gap-2">
                        <h2 className="text-sm font-semibold text-gray-900">{t("aiEmployee.jobDesc.title", "Job desc")}</h2>
                      <section className="rounded-md border border-border bg-card p-3">
                        <h3 className="mb-2 text-sm font-semibold">{t("aiEmployee.work.weeklyPlan", "Content Plan")}</h3>
                        {!canEdit ? (
                          <p className="mb-2 text-xs text-muted-foreground">{t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")}</p>
                        ) : null}
                        {schedules.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("aiEmployee.schedule.empty", "Belum ada jadwal.")}</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {schedules.map((row, index) => {
                              const key = `${row.sopCode}-${index}`;
                              const original = page.schedules[index];
                              const dirty = original ? !sameSchedule(original, row) : false;
                              return (
                                <div key={key}>
                                  {row.sopCode !== "SOP1" ? <p className="mb-2 text-sm font-medium">{workName(row.sopCode, t)}</p> : null}
                                  <label className="mb-2 block text-xs text-muted-foreground">
                                    {t("aiEmployee.schedule.weekday", "Hari")}
                                    <select
                                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                                      value={row.weekday}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateSchedule(key, { weekday: Number(event.target.value) })}
                                    >
                                      {WEEKDAYS.map((day) => (
                                        <option key={day.value} value={day.value}>{day.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="mb-2 grid grid-cols-2 gap-2">
                                    <label className="text-xs text-muted-foreground">
                                      {t("aiEmployee.schedule.start", "Mulai")}
                                      <input
                                        type="time"
                                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                        value={row.startLocal}
                                        disabled={!canEdit || saving}
                                        onChange={(event) => updateSchedule(key, { startLocal: event.target.value })}
                                      />
                                    </label>
                                    <label className="text-xs text-muted-foreground">
                                      {t("aiEmployee.schedule.due", "Selesai")}
                                      <input
                                        type="time"
                                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                        value={row.dueLocal}
                                        disabled={!canEdit || saving}
                                        onChange={(event) => updateSchedule(key, { dueLocal: event.target.value })}
                                      />
                                    </label>
                                  </div>
                                  <label className="mb-2 flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={row.isActive}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateSchedule(key, { isActive: event.target.checked })}
                                    />
                                    {t("aiEmployee.schedule.active", "Jadwal aktif")}
                                  </label>
                                  <p className="mb-2 text-xs text-muted-foreground">
                                    {t("aiEmployee.schedule.next", "Jalan berikutnya {{time}}", { time: formatWhen(original?.nextRunAt ?? null, dateLocale) })}
                                  </p>
                                  {canEdit ? (
                                    <Button type="button" size="sm" disabled={!dirty || saving || !original} onClick={() => {
                                      if (!original) return;
                                      setScheduleCompare({ before: original, after: row });
                                    }}>
                                      {t("aiEmployee.schedule.review", "Tinjau jadwal")}
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-3 border-t border-border pt-3">
                          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("aiEmployee.brief.title", "Brief")}</h4>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.services", "Katalog")}
                            <div className="mt-1">
                              <MultiSelect
                                label={t("aiEmployee.brief.pickServices", "Pilih katalog")}
                                emptyLabel={t("aiEmployee.brief.noServices", "Tidak ada katalog")}
                                options={page.options.services}
                                value={brief.serviceIds}
                                disabled={!canEdit || saving}
                                onToggle={(id) => setBrief((current) => {
                                  if (!current) return current;
                                  const serviceIds = toggleId(current.serviceIds, id);
                                  const allowed = new Set(serviceIds);
                                  const productIds = current.productIds.filter((productId) => {
                                    const product = page.options.products.find((item) => item.id === productId);
                                    if (!product) return false;
                                    return (product.serviceId != null && allowed.has(product.serviceId))
                                      || (product.parentServiceId != null && allowed.has(product.parentServiceId));
                                  });
                                  return { ...current, serviceIds, productIds };
                                })}
                              />
                            </div>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.personas", "Persona")}
                            <div className="mt-1">
                              <MultiSelect
                                label={t("aiEmployee.brief.pickPersonas", "Pilih persona")}
                                emptyLabel={t("aiEmployee.brief.noPersonas", "Tidak ada persona")}
                                options={page.options.personas}
                                value={brief.personaIds}
                                disabled={!canEdit || saving}
                                onToggle={(id) => setBrief((current) => current ? { ...current, personaIds: toggleId(current.personaIds, id) } : current)}
                              />
                            </div>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.pillars", "Pilar")}
                            <div className="mt-1">
                              <MultiSelect
                                label={t("aiEmployee.brief.pickPillars", "Pilih pilar")}
                                emptyLabel={t("aiEmployee.brief.noPillars", "Tidak ada pilar")}
                                options={page.options.pillars}
                                value={brief.pillarIds}
                                disabled={!canEdit || saving}
                                onToggle={(id) => setBrief((current) => current ? { ...current, pillarIds: toggleId(current.pillarIds, id) } : current)}
                              />
                            </div>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.products", "Product Knowledge")}
                            <div className="mt-1">
                              <MultiSelect
                                label={brief.serviceIds.length === 0
                                  ? t("aiEmployee.brief.pickServiceFirst", "Pilih katalog dulu")
                                  : t("aiEmployee.brief.pickProducts", "Pilih Product Knowledge")}
                                emptyLabel={t("aiEmployee.brief.noProducts", "Tidak ada Product Knowledge untuk katalog ini")}
                                options={visibleProducts}
                                value={brief.productIds}
                                disabled={!canEdit || saving || brief.serviceIds.length === 0}
                                onToggle={(id) => setBrief((current) => current ? { ...current, productIds: toggleId(current.productIds, id) } : current)}
                              />
                            </div>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.audience", "Audiens")}
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              maxLength={1000}
                              value={brief.audience}
                              disabled={!canEdit || saving}
                              onChange={(event) => setBrief((current) => current ? { ...current, audience: event.target.value } : current)}
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.voice", "Suara")}
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              maxLength={1000}
                              value={brief.voice}
                              disabled={!canEdit || saving}
                              onChange={(event) => setBrief((current) => current ? { ...current, voice: event.target.value } : current)}
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.required", "Catatan wajib")}
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              maxLength={2000}
                              value={brief.requiredNotes}
                              disabled={!canEdit || saving}
                              onChange={(event) => setBrief((current) => current ? { ...current, requiredNotes: event.target.value } : current)}
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.forbidden", "Catatan terlarang")}
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              maxLength={2000}
                              value={brief.forbiddenNotes}
                              disabled={!canEdit || saving}
                              onChange={(event) => setBrief((current) => current ? { ...current, forbiddenNotes: event.target.value } : current)}
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            {t("aiEmployee.brief.split", "Aturan pecahan")}
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              maxLength={1000}
                              value={brief.splitRule}
                              disabled={!canEdit || saving}
                              onChange={(event) => setBrief((current) => current ? { ...current, splitRule: event.target.value } : current)}
                            />
                          </label>
                          {canEdit ? (
                            <Button
                              type="button"
                              disabled={saving || sameBrief(page.brief, brief)}
                              onClick={() => setBriefOpen(true)}
                            >
                              {t("aiEmployee.brief.review", "Tinjau brief")}
                            </Button>
                          ) : null}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-md border border-border bg-card p-3">
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold">{t("aiEmployee.routine.title", "Laporan email")}</h3>
                          <p className="text-xs text-muted-foreground">
                            {t("aiEmployee.routine.recipientShort", "{{name}}", {
                              name: page.routines[0]?.reviewerName || page.summary.reviewerName || "—",
                            })}
                          </p>
                        </div>
                        {!canEdit ? (
                          <p className="mb-2 text-xs text-muted-foreground">{t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")}</p>
                        ) : null}
                        <div className="flex flex-col">
                          {reportRoutines.map((row) => {
                            const saved = page.routines.find((item) => item.actionCode === row.actionCode) ?? null;
                            const next = formatWhen(saved?.nextRunAt ?? null, dateLocale);
                            const sent = formatWhen(saved?.lastSentAt ?? null, dateLocale);
                            const status = routineStatus(saved?.lastStatus ?? null);
                            const meta = sent === "—"
                              ? t("aiEmployee.routine.metaPending", "Berikutnya {{next}} · {{status}}", { next, status })
                              : t("aiEmployee.routine.metaSent", "Berikutnya {{next}} · {{status}} {{sent}}", { next, status, sent });
                            const selectedDays = row.cadence === "weekly" ? (row.weekday == null ? [] : [row.weekday]) : (row.weekdays ?? []);
                            const blockedDay = row.cadence === "days" ? blockedReportDay(reportRoutines) : null;
                            const dayMissing = row.isActive && (
                              row.cadence === "days"
                                ? selectedDays.length === 0
                                : row.cadence === "weekly" && row.weekday == null
                            );
                            const help = row.cadence === "days"
                              ? t("aiEmployee.routine.helpDaily", "Hari yang sama dengan mingguan tidak dikirim. Pada tanggal terakhir, yang terkirim hanya laporan bulanan. Isinya pekerjaan hari ini sejak tengah malam.")
                              : row.cadence === "weekly"
                                ? t("aiEmployee.routine.helpWeekly", "Bila hari ini tanggal terakhir dan laporan bulanan aktif, yang terkirim hanya laporan bulanan.")
                                : t("aiEmployee.routine.helpMonthly", "Pada tanggal terakhir, harian dan mingguan hari itu tidak dikirim. Isinya pekerjaan sejak awal bulan atau kiriman bulanan sebelumnya.");
                            const toggleDay = (day: number) => {
                              if (blockedDay === day) return;
                              if (row.cadence === "weekly") {
                                updateRoutine(row.actionCode, { weekday: day });
                                return;
                              }
                              const weekdays = selectedDays.includes(day)
                                ? selectedDays.filter((value) => value !== day)
                                : [...selectedDays, day].sort((left, right) => left - right);
                              updateRoutine(row.actionCode, { weekdays });
                            };
                            return (
                              <div key={row.actionCode} className="border-t border-border py-2 first:border-t-0 first:pt-0">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{routineTitle(row)}</p>
                                  {canEdit ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7"
                                      disabled={saving || dayMissing || (saved ? sameRoutine(saved, row) : false)}
                                      onClick={() => setRoutineCompare({ before: saved, after: row })}
                                    >
                                      {t("aiEmployee.routine.reviewShort", "Tinjau")}
                                    </Button>
                                  ) : null}
                                </div>
                                {row.cadence === "monthly" ? (
                                  <p className="mb-1 text-sm">{runningMonthEnd(dateLocale)}</p>
                                ) : (
                                  <div className="mb-1 flex flex-wrap gap-1">
                                    {WEEKDAYS.map((day) => {
                                      const blocked = blockedDay === day.value;
                                      const selected = !blocked && selectedDays.includes(day.value);
                                      return (
                                        <button
                                          key={day.value}
                                          type="button"
                                          aria-pressed={selected}
                                          aria-disabled={blocked}
                                          aria-label={day.label}
                                          title={blocked ? t("aiEmployee.routine.dayTaken", "{{day}} dipakai laporan lain", { day: day.label }) : day.label}
                                          disabled={!canEdit || saving || blocked}
                                          className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-medium ${blocked ? "border border-dashed border-input bg-muted text-muted-foreground" : selected ? "bg-primary text-primary-foreground" : "border border-input bg-background text-muted-foreground"} disabled:opacity-50`}
                                          onClick={() => toggleDay(day.value)}
                                        >
                                          {day.short}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="time"
                                    aria-label={t("aiEmployee.routine.time", "Jam kirim")}
                                    className="h-8 w-[7.5rem] rounded-md border border-input bg-background px-2 text-sm"
                                    value={row.timeLocal}
                                    disabled={!canEdit || saving}
                                    onChange={(event) => updateRoutine(row.actionCode, { timeLocal: event.target.value })}
                                  />
                                  <label className="flex items-center gap-1.5 text-xs text-foreground">
                                    <input
                                      type="checkbox"
                                      checked={row.isActive}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateRoutine(row.actionCode, { isActive: event.target.checked })}
                                    />
                                    {t("aiEmployee.page.active", "Aktif")}
                                  </label>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{help}</p>
                                {saved?.lastError ? <p className="mt-1 text-xs text-muted-foreground">{saved.lastError}</p> : null}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
                          <p className="truncate text-xs text-muted-foreground" title={page.routines.find((item) => item.reviewerEmail)?.reviewerEmail || undefined}>
                            {t("aiEmployee.routine.primaryEmail", "Penerima utama {{email}}", {
                              email: page.routines.find((item) => item.reviewerEmail)?.reviewerEmail || t("aiEmployee.routine.noEmail", "belum ada email"),
                            })}
                          </p>
                          <input
                            type="email"
                            aria-label={t("aiEmployee.routine.copyEmail1", "Email tambahan 1")}
                            placeholder={t("aiEmployee.routine.copyEmail1", "Email tambahan 1")}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={copyEmail1}
                            disabled={!canEdit || saving}
                            onChange={(event) => setCopyEmail1(event.target.value)}
                          />
                          <input
                            type="email"
                            aria-label={t("aiEmployee.routine.copyEmail2", "Email tambahan 2")}
                            placeholder={t("aiEmployee.routine.copyEmail2", "Email tambahan 2")}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={copyEmail2}
                            disabled={!canEdit || saving}
                            onChange={(event) => setCopyEmail2(event.target.value)}
                          />
                          {canEdit ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7"
                              disabled={saving || (copyEmail1.trim() === (page.summary.reportCopyEmail1 ?? "") && copyEmail2.trim() === (page.summary.reportCopyEmail2 ?? ""))}
                              onClick={() => void confirmCopies()}
                            >
                              {t("aiEmployee.routine.saveCopies", "Simpan email")}
                            </Button>
                          ) : null}
                        </div>
                      </section>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-card p-4 text-sm text-gray-700">
                    <p>{failureText}</p>
                    {model.failure === "other" || model.failure === "invalid" ? (
                      <Button type="button" variant="outline" className="mt-3" onClick={() => void model.reload()}>
                        {t("aiEmployee.page.retry", "Muat ulang")}
                      </Button>
                    ) : null}
                  </div>
                )}
                <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div className="absolute inset-0 z-10 overflow-hidden">
          <AiEmployeePageSkeleton />
        </div>
      ) : null}

      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("aiEmployee.brief.compareTitle", "Brief lama dan baru")}</DialogTitle>
            <DialogDescription>
              {t("aiEmployee.brief.compareHelp", "Periksa perubahan ini sebelum disimpan.")}
            </DialogDescription>
          </DialogHeader>
          <ChangeTable rows={pendingBrief} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setBriefOpen(false)}>
              {t("aiEmployee.page.cancel", "Batal")}
            </Button>
            <Button type="button" disabled={saving || pendingBrief.length === 0} onClick={() => void confirmBrief()}>
              {saving ? t("aiEmployee.page.saving", "Menyimpan…") : t("aiEmployee.page.save", "Simpan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleCompare != null} onOpenChange={(open) => { if (!open) setScheduleCompare(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("aiEmployee.schedule.compareTitle", "Jadwal lama dan baru")}</DialogTitle>
            <DialogDescription>{workName(scheduleCompare?.after.sopCode ?? null, t)}</DialogDescription>
          </DialogHeader>
          {scheduleCompare ? (
            <ChangeTable
              rows={[
                {
                  label: t("aiEmployee.schedule.weekday", "Hari"),
                  before: WEEKDAYS.find((day) => day.value === scheduleCompare.before.weekday)?.label ?? String(scheduleCompare.before.weekday),
                  after: WEEKDAYS.find((day) => day.value === scheduleCompare.after.weekday)?.label ?? String(scheduleCompare.after.weekday),
                },
                { label: t("aiEmployee.schedule.start", "Mulai"), before: scheduleCompare.before.startLocal, after: scheduleCompare.after.startLocal },
                { label: t("aiEmployee.schedule.due", "Selesai"), before: scheduleCompare.before.dueLocal, after: scheduleCompare.after.dueLocal },
                {
                  label: t("aiEmployee.schedule.active", "Jadwal aktif"),
                  before: scheduleCompare.before.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif"),
                  after: scheduleCompare.after.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif"),
                },
              ].filter((row) => row.before !== row.after)}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setScheduleCompare(null)}>
              {t("aiEmployee.page.cancel", "Batal")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void confirmSchedule()}>
              {saving ? t("aiEmployee.page.saving", "Menyimpan…") : t("aiEmployee.page.save", "Simpan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={routineCompare != null} onOpenChange={(open) => { if (!open) setRoutineCompare(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("aiEmployee.routine.compareTitle", "Rutinitas lama dan baru")}</DialogTitle>
            <DialogDescription>{routineCompare ? routineTitle(routineCompare.after) : t("aiEmployee.routine.action", "Laporan kerja lewat email")}</DialogDescription>
          </DialogHeader>
          {routineCompare ? (
            <ChangeTable
              rows={[
                {
                  label: t("aiEmployee.routine.cadence", "Irama"),
                  before: routineCompare.before ? cadenceLabel(routineCompare.before) : t("aiEmployee.routine.none", "Belum ada"),
                  after: cadenceLabel(routineCompare.after),
                },
                {
                  label: t("aiEmployee.routine.active", "Rutinitas aktif"),
                  before: routineCompare.before
                    ? (routineCompare.before.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif"))
                    : t("aiEmployee.routine.none", "Belum ada"),
                  after: routineCompare.after.isActive ? t("aiEmployee.page.active", "Aktif") : t("aiEmployee.page.inactive", "Tidak aktif"),
                },
              ].filter((row) => row.before !== row.after)}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setRoutineCompare(null)}>
              {t("aiEmployee.page.cancel", "Batal")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void confirmRoutine()}>
              {saving ? t("aiEmployee.page.saving", "Menyimpan…") : t("aiEmployee.page.save", "Simpan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
