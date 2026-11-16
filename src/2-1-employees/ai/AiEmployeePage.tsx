import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { isGeminiBillingNoticeError } from "@/shared/ai/geminiSpendCap";
import { useToast } from "@/shared/hooks/use-toast";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { AiEmployeePageSkeleton } from "./AiEmployeePageSkeleton";
import { AiEmployeeRunLog, RUN_LOG_KEY } from "./AiEmployeeRunLog";
import { AiEmployeeStoryPlansTable } from "./AiEmployeeStoryPlansTable";
import { STORY_PLANS_KEY } from "./storyPlans";
import { useQueryClient } from "@tanstack/react-query";
import {
  briefChanges,
  classifyAiEmployeeError,
  sameBrief,
  sameBriefExceptAngles,
  sameIds,
  sameRoutine,
  sameSchedule,
} from "./parse";
import { pillarsForLockedIdeas, clampBriefPillarIds, syncPillarIdsForAngles } from "./angleCatalog";
import { canAddScheduleTime } from "./scheduleTimes";
import type { BriefDraft, CatalogOption, RoutineRow, ScheduleRow } from "./types";
import { useSopRunning } from "./runningSop";
import { useBriefPillarUsage } from "./pillarUsage";
import { useAiEmployeePage } from "./useAiEmployeePage";
import {
  AngleDetailDialog,
  ChangeTable,
  listed,
} from "./AiEmployeeBriefFields";
import { AiEmployeeBriefPanel } from "./AiEmployeeBriefPanel";
import { AiEmployeeStoryBriefPanel } from "./AiEmployeeStoryBriefPanel";
import {
  emptyStoryBriefDraft,
  sameStoryBrief,
  storyBriefChanges,
} from "./storyBriefPayload";
import type { StoryBriefDraft } from "./storyBriefTypes";
import {
  ThinkingLabQueueBlockedDialog,
  type ThinkingLabQueueBlockReason,
} from "./ThinkingLabQueueBlockedDialog";
import { setThinkingLabFokusEmployee } from "@/thinking-lab/hooks/useThinkingLabAngleFocus";
import {
  CarouselExecutionCheckProgressDialog,
  progressFromGenerateResult,
  type ExecutionCheckProgress,
} from "./CarouselExecutionCheckProgress";


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
  if (code === "SOP1") return label("aiEmployee.work.weeklyPlan", "Content Plan Carousel");
  if (code === "SOP2") return label("aiEmployee.work.adHoc", "Menerima dan mengerjakan tugas dadakan");
  if (code === "SOP3") return label("aiEmployee.work.revision", "Merevisi hasil yang ditolak");
  if (code === "SOP4") return label("aiEmployee.work.designStory", "Design Story");
  if (code === "CHAT") return label("aiEmployee.work.chat", "Percakapan");
  return code || "—";
}


function clockLabel(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ContentPlanTiming({
  times,
  disabled,
  onChange,
}: {
  times: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const sorted = [...times].sort();
  const count = pending != null && pending > sorted.length ? pending : sorted.length;
  useEffect(() => {
    if (pending != null && sorted.length >= pending) setPending(null);
  }, [pending, sorted.length]);
  const multiple = sorted.length > 1 || count > 1;
  const add = (value: string) => {
    if (!canAddScheduleTime(sorted, value)) {
      setNotice("Jarak minimal satu jam.");
      return;
    }
    setNotice("");
    setDraft("");
    onChange([...sorted, value].sort());
  };
  const setCount = (next: number) => {
    if (!Number.isInteger(next) || next < 1 || next > 7) return;
    if (next < sorted.length) {
      setPending(null);
      setOpen(false);
      onChange(sorted.slice(0, next));
      return;
    }
    if (next > sorted.length) {
      setPending(next);
      setOpen(true);
    }
  };
  return (
    <>
      <TableCell>
        <input
          type="number"
          min={1}
          max={7}
          aria-label="Frekuensi"
          className="h-8 w-14 rounded-md border border-input bg-background px-2 text-sm"
          value={count}
          disabled={disabled}
          onChange={(event) => setCount(Number(event.target.value))}
        />
      </TableCell>
      <TableCell>
        {multiple ? (
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next && pending != null && sorted.length < pending) setPending(null);
            }}
          >
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-8 w-[7.5rem] justify-between px-2 font-normal" aria-label="Mulai">
                <span className="truncate">{sorted.map(clockLabel).join(", ")}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 space-y-2 p-3">
              {sorted.map((time) => (
                <div key={time} className="flex items-center justify-between gap-2 text-sm">
                  <span>{clockLabel(time)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={disabled || sorted.length <= 1}
                    onClick={() => onChange(sorted.filter((item) => item !== time))}
                  >
                    Hapus
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="time"
                  aria-label="Jam tambahan"
                  className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  value={draft}
                  disabled={disabled || sorted.length >= 7}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button type="button" size="sm" variant="outline" disabled={disabled || !draft || sorted.length >= 7} onClick={() => add(draft)}>
                  Tambah
                </Button>
              </div>
              {notice ? <p className="text-xs text-destructive">{notice}</p> : null}
            </PopoverContent>
          </Popover>
        ) : (
          <input
            type="time"
            aria-label="Mulai"
            className="h-8 w-[7.5rem] rounded-md border border-input bg-background px-2 text-sm"
            value={sorted[0] ?? "09:00"}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value) onChange([event.target.value]);
            }}
          />
        )}
      </TableCell>
    </>
  );
}

export default function AiEmployeePage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { t, dateLocale } = useAppTranslation();
  const { toast } = useToast();
  const model = useAiEmployeePage(employeeId);
  const queryClient = useQueryClient();
  // Spinner next to "Berikutnya" while a Content Plan run is going; refresh when it ends.
  const sopRunning = useSopRunning(employeeId, "SOP1", () => {
    void model.reload();
    void queryClient.invalidateQueries({ queryKey: [RUN_LOG_KEY] });
  });
  const sop4Running = useSopRunning(employeeId, "SOP4", () => {
    void model.reload();
    void queryClient.invalidateQueries({ queryKey: [RUN_LOG_KEY] });
    void queryClient.invalidateQueries({ queryKey: [STORY_PLANS_KEY] });
  });
  const [storyGenerating, setStoryGenerating] = useState(false);
  const storyGeneratingRef = useRef(false);
  const showContent = useDebouncedReady(!model.showFullPageSkeleton, 200);
  const [brief, setBrief] = useState<BriefDraft | null>(null);
  const [storyBrief, setStoryBrief] = useState<StoryBriefDraft | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [reportRoutines, setReportRoutines] = useState<RoutineRow[]>(() => draftRoutines(null));
  const [copyEmail1, setCopyEmail1] = useState("");
  const [copyEmail2, setCopyEmail2] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const [storyBriefOpen, setStoryBriefOpen] = useState(false);
  const [angleDetailId, setAngleDetailId] = useState<string | null>(null);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);
  const [storyBriefPanelOpen, setStoryBriefPanelOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [scheduleCompare, setScheduleCompare] = useState<{ before: ScheduleRow; after: ScheduleRow } | null>(null);
  const [routineCompare, setRoutineCompare] = useState<{ before: RoutineRow | null; after: RoutineRow } | null>(null);
  const [reportCode, setReportCode] = useState("work_report.daily");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionCheckProgress | null>(null);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [queueBlockReason, setQueueBlockReason] = useState<ThinkingLabQueueBlockReason | null>(null);
  const generatingRef = useRef(false);
  const page = model.page;
  const pageRef = useRef(page);
  pageRef.current = page;
  const briefKey = page ? JSON.stringify(page.brief) : "";
  const storyBriefKey = page ? JSON.stringify(page.storyBrief) : "";
  const scheduleKey = page ? JSON.stringify(page.schedules) : "";
  const routineKey = page ? JSON.stringify(page.routines) : "";
  const copyKey = page ? `${page.summary.reportCopyEmail1 ?? ""}|${page.summary.reportCopyEmail2 ?? ""}` : "";

  useEffect(() => {
    setBrief(null);
    setStoryBrief(null);
    setSchedules([]);
    setReportRoutines(draftRoutines(null));
    setCopyEmail1("");
    setCopyEmail2("");
    setBriefOpen(false);
    setStoryBriefOpen(false);
    setStoryBriefPanelOpen(false);
    setScheduleCompare(null);
    setRoutineCompare(null);
  }, [employeeId]);

  const briefDraftRef = useRef(brief);
  briefDraftRef.current = brief;
  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    const withPrunedPillars = (draft: BriefDraft): BriefDraft => ({
      ...draft,
      pillarIds: clampBriefPillarIds(draft.pillarIds, draft.angleIds),
    });
    const prev = briefDraftRef.current;
    if (!prev) {
      setBrief(withPrunedPillars(current.brief));
      return;
    }
    if (sameBrief(prev, current.brief) && sameIds(prev.pillarIds, clampBriefPillarIds(prev.pillarIds, prev.angleIds))) return;
    // Dirty draft on other fields: only pull Fokus angle + locked pillars (e.g. Thinking Lab save).
    if (!sameBriefExceptAngles(prev, current.brief)) {
      if (sameIds(prev.angleIds, current.brief.angleIds)) {
        const clamped = clampBriefPillarIds(prev.pillarIds, prev.angleIds);
        if (!sameIds(prev.pillarIds, clamped)) setBrief({ ...prev, pillarIds: clamped });
        return;
      }
      const angleIds = current.brief.angleIds;
      setBrief({
        ...prev,
        angleIds,
        pillarIds: syncPillarIdsForAngles(current.options.angles, angleIds),
      });
      if (briefPanelOpen) {
        toast({
          title: t("aiEmployee.brief.anglesSynced", "Fokus angle diperbarui dari Thinking Lab"),
        });
      }
      return;
    }
    setBrief(withPrunedPillars(current.brief));
  }, [briefKey, briefPanelOpen, t, toast]);

  const storyBriefDraftRef = useRef(storyBrief);
  storyBriefDraftRef.current = storyBrief;
  useEffect(() => {
    const current = pageRef.current;
    if (!current) return;
    const withPrunedPillars = (draft: StoryBriefDraft): StoryBriefDraft => ({
      ...draft,
      pillarIds: clampBriefPillarIds(draft.pillarIds, draft.angleIds),
    });
    const prev = storyBriefDraftRef.current;
    if (!prev) {
      setStoryBrief(withPrunedPillars(current.storyBrief));
      return;
    }
    if (sameStoryBrief(prev, current.storyBrief)
      && sameIds(prev.pillarIds, clampBriefPillarIds(prev.pillarIds, prev.angleIds))) {
      return;
    }
    setStoryBrief(withPrunedPillars(current.storyBrief));
  }, [storyBriefKey]);

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
        angles: new Map<string, string>(),
        subServices: new Map<string, string>(),
      };
    }
    return {
      services: nameMap(page.options.services, page.briefLabels.services),
      personas: nameMap(page.options.personas, page.briefLabels.personas),
      pillars: nameMap(page.options.pillars, page.briefLabels.pillars),
      products: nameMap(page.options.products, page.briefLabels.products),
      angles: nameMap(page.options.angles, page.briefLabels.angles),
      subServices: new Map(page.subServices.map((item) => [item.id, item.name])),
    };
  }, [page]);

  const pendingBrief = page && brief ? briefChanges(page.brief, brief, names) : [];
  const storyNames = useMemo(() => {
    if (!page) {
      return {
        services: new Map<string, string>(),
        angles: new Map<string, string>(),
        pillars: new Map<string, string>(),
      };
    }
    return {
      services: nameMap(page.options.services, page.storyBriefLabels.services),
      angles: nameMap(page.options.angles, page.storyBriefLabels.angles),
      pillars: nameMap(page.options.pillars, page.storyBriefLabels.pillars),
    };
  }, [page]);
  const pendingStoryBrief = page && storyBrief
    ? storyBriefChanges(page.storyBrief, storyBrief, storyNames)
    : [];
  const canEdit = Boolean(page?.canEdit);
  const statusLabel = (status: string | null) => {
    if (status === "on_track") return t("aiEmployee.status.onTrack", "Sesuai jalur");
    if (status === "attention") return t("aiEmployee.status.attention", "Perlu perhatian");
    if (status === "coaching") return t("aiEmployee.status.coaching", "Pembinaan");
    if (status === "disabled") return t("aiEmployee.status.disabled", "Dinonaktifkan");
    return status || "—";
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
    const description = raw.includes("times_too_close")
      ? t("aiEmployee.schedule.timesTooClose", "Jarak antar jam minimal satu jam.")
      : raw.includes("invalid_email")
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

  const confirmStoryBrief = async () => {
    if (!storyBrief) return;
    setSaving(true);
    try {
      await model.saveStoryBrief(storyBrief);
      setStoryBriefOpen(false);
      toast({ title: t("aiEmployee.story.briefSaved", "Brief Design Story tersimpan") });
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

  const updateSchedule = (patch: Partial<ScheduleRow>) => {
    setSchedules((current) => current.map((row) => {
      if (row.sopCode !== "SOP1" || row.cadence !== "days") return row;
      const next = { ...row, ...patch };
      if (next.startTimes.length > 0) next.startLocal = [...next.startTimes].sort()[0];
      return next;
    }));
  };

  /** Design Story (SOP4) — terpisah dari updateSchedule SOP1. */
  const updateStorySchedule = (patch: Partial<ScheduleRow>) => {
    setSchedules((current) => current.map((row) => {
      if (row.sopCode !== "SOP4" || row.cadence !== "days") return row;
      const next = { ...row, ...patch };
      if (next.startTimes.length > 0) next.startLocal = [...next.startTimes].sort()[0];
      return next;
    }));
  };

  const openThinkingLabFromQueueBlock = () => {
    setThinkingLabFokusEmployee(page?.organizationId ?? null, employeeId ?? null);
    setQueueBlockReason(null);
    navigate("/digital-marketing/social-media/thinking-lab");
  };

  const reportGenerateError = (error: unknown) => {
    if (isGeminiBillingNoticeError(error)) return;
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
    if (raw.includes("path_unconfirmed")) {
      setQueueBlockReason("path_unconfirmed");
      return;
    }
    if (raw.includes("ideas_blocked")) {
      setQueueBlockReason("ideas_blocked");
      return;
    }
      const description = raw.includes("too_soon")
        ? t("aiEmployee.schedule.tooSoon", "Plan sebelumnya masih dibuat. Tunggu sampai selesai.")
        : raw.includes("catalog_limit")
          ? t("aiEmployee.schedule.catalogLimit", "Pilih satu katalog di brief.")
          : raw.includes("brief_missing")
          ? t("aiEmployee.schedule.briefMissing", "Isi katalog pada brief terlebih dahulu.")
          : raw.includes("checks_failed")
          ? t("aiEmployee.schedule.checksFailed", "Semua draf gagal dicek. Coba lagi.")
          : raw.includes("time_budget")
          ? t("aiEmployee.schedule.timeBudget", "Waktu pembuatan habis sebelum draf lolos. Coba lagi.")
          : raw.includes("quota_exceeded")
          ? t("aiEmployee.schedule.quota", "Kuota model hari ini habis.")
          : raw.includes("forbidden")
            ? t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")
                  : "";
    const title = t("aiEmployee.schedule.generateFailed", "Plan tidak dibuat.");
    toast({
      title,
      description: description && description !== title ? description : undefined,
      variant: "destructive",
    });
  };

  const generatePlanNow = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    // Don't block the page with a pending 10-row modal — toast/button spinner is enough while waiting.
    setExecutionProgress(null);
    try {
      const result = await model.generateNow();
      // Success: toast only. Checklist is useful when quality checks reject a draft.
      setExecutionProgress(null);
      toast({
        title: result.planCount > 0
          ? t("aiEmployee.schedule.generated", "Plan dibuat")
          : t("aiEmployee.schedule.generatedEmpty", "Tidak ada plan baru"),
      });
    } catch (error) {
      const detail = error as Error & {
        executionCheckEnabled?: boolean;
        executionChecks?: Array<{ id: string; state: string }> | null;
        rejectCheck?: string;
      };
      const message = String(detail?.message ?? "");
      if (message.includes("checks_failed") || detail.executionChecks || detail.rejectCheck) {
        setExecutionProgress(progressFromGenerateResult({
          enabled: detail.executionCheckEnabled !== false,
          checks: detail.executionChecks,
          rejectCheck: detail.rejectCheck || (message.includes("checks_failed") ? "checks_failed" : undefined),
          failed: true,
        }));
        // Modal already explains which check failed — keep toast short.
        toast({
          title: t("aiEmployee.schedule.generateFailed", "Plan tidak dibuat."),
          description: t("aiEmployee.schedule.checksFailedShort", "Cek kualitas menolak semua draf."),
          variant: "destructive",
        });
      } else {
        setExecutionProgress(null);
        reportGenerateError(error);
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: [RUN_LOG_KEY] });
      generatingRef.current = false;
      setGenerating(false);
      setPlanMenuOpen(false);
    }
  };

  const generateStoryNow = async () => {
    if (storyGeneratingRef.current) return;
    storyGeneratingRef.current = true;
    setStoryGenerating(true);
    try {
      const result = await model.generateStoryNow();
      toast({
        title: result.planCount > 0
          ? t("aiEmployee.story.generated", "Story dibuat")
          : t("aiEmployee.story.generatedEmpty", "Tidak ada Story baru"),
      });
    } catch (error) {
      reportGenerateError(error);
    } finally {
      void queryClient.invalidateQueries({ queryKey: [RUN_LOG_KEY] });
      void queryClient.invalidateQueries({ queryKey: [STORY_PLANS_KEY] });
      storyGeneratingRef.current = false;
      setStoryGenerating(false);
    }
  };

  const visiblePillars = page && brief
    ? pillarsForLockedIdeas(page.options.pillars, page.options.angles, brief.angleIds)
    : [];
  const visibleStoryPillars = page && storyBrief
    ? pillarsForLockedIdeas(page.options.pillars, page.options.angles, storyBrief.angleIds)
    : [];
  const pillarUsage = useBriefPillarUsage(
    page?.organizationId,
    brief?.serviceIds[0] ?? null,
    page?.options.pillars.map((pillar) => pillar.id) ?? [],
  );
  const storyPillarUsage = useBriefPillarUsage(
    page?.organizationId,
    storyBrief?.serviceIds[0] ?? null,
    page?.options.pillars.map((pillar) => pillar.id) ?? [],
  );

  const visibleProducts = page && brief
    ? page.options.products.filter((product) => {
      const selected = brief.productIds.includes(product.id);
      const sameCategory = product.serviceId != null && brief.serviceIds.includes(product.serviceId);
      return selected || sameCategory;
    })
    : [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={cn("flex min-h-0 min-w-0 w-full flex-1", !showContent && "pointer-events-none invisible")}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-2 flex-shrink-0 px-1 pt-1">
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
                  <div className="grid w-full min-w-0 flex-1 content-start grid-cols-12 items-start gap-2">
                    <div className="col-span-12 flex min-w-0 flex-col gap-2">
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
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.quota.title", "Kuota hari ini")}</dt>
                            <dd>
                              {page.quota.cap == null
                                ? t("aiEmployee.quota.unknown", "{{used}} terpakai", { used: page.quota.used })
                                : t("aiEmployee.quota.employee", "{{used}} terpakai, {{remaining}} sisa", {
                                  used: page.quota.used,
                                  remaining: page.quota.remaining ?? 0,
                                })}
                              <span className="text-muted-foreground">
                                {" · "}
                                {t("aiEmployee.quota.employeeCap", "Batas karyawan {{cap}} · {{date}} WIB", {
                                  cap: page.quota.cap ?? "—",
                                  date: page.quota.usageDate || "—",
                                })}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("aiEmployee.quota.orgTitle", "Batas organisasi")}</dt>
                            <dd>
                              {t("aiEmployee.quota.orgValue", "{{used}} terpakai, {{remaining}} sisa dari {{limit}} · {{date}} UTC", {
                                used: page.quota.orgUsed,
                                remaining: page.quota.orgRemaining,
                                limit: page.quota.orgLimit,
                                date: page.quota.orgUsageDate || "—",
                              })}
                            </dd>
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
                    </div>

                    <div className="col-span-12 flex min-w-0 flex-col gap-2">
                      <section className="rounded-md border border-border bg-card p-3">
                        <h2 className="mb-2 text-sm font-semibold">{t("aiEmployee.jobDesc.title", "Job desc")}</h2>
                        {!canEdit ? (
                          <p className="mb-2 text-xs text-muted-foreground">{t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")}</p>
                        ) : null}
                        <Table containerClassName="overflow-x-auto" className="table-fixed min-w-[90rem]">
                          <colgroup>
                            <col className="w-[9.5rem]" />
                            <col className="w-[12rem]" />
                            <col className="w-[16rem]" />
                            <col className="w-[15.5rem]" />
                            <col className="w-[5.5rem]" />
                            <col className="w-[9rem]" />
                            <col className="w-[4.5rem]" />
                            <col className="w-[14rem]" />
                            <col className="w-[4rem]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("aiEmployee.jobDesc.work", "Pekerjaan")}</TableHead>
                              <TableHead>{t("aiEmployee.brief.services", "Katalog")}</TableHead>
                              <TableHead>{t("aiEmployee.routine.reportColumn", "Laporan")}</TableHead>
                              <TableHead>{t("aiEmployee.schedule.weekday", "Hari")}</TableHead>
                              <TableHead>{t("aiEmployee.schedule.frequency", "Frekuensi")}</TableHead>
                              <TableHead>{t("aiEmployee.schedule.start", "Mulai")}</TableHead>
                              <TableHead>{t("aiEmployee.page.active", "Aktif")}</TableHead>
                              <TableHead>{t("aiEmployee.jobDesc.next", "Berikutnya")}</TableHead>
                              <TableHead>{t("aiEmployee.jobDesc.action", "Aksi")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const row = schedules.find((item) => item.sopCode === "SOP1" && item.cadence === "days") ?? null;
                              if (!row) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={9} className="text-muted-foreground">
                                      {t("aiEmployee.schedule.empty", "Belum ada jadwal.")}
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              const original = page.schedules.find((item) => item.sopCode === "SOP1" && item.cadence === "days") ?? null;
                              const dirty = original ? !sameSchedule(original, row) : false;
                              const selectedDays = row.weekdays;
                              const dayMissing = row.isActive && selectedDays.length === 0;
                              const toggleDay = (day: number) => {
                                const weekdays = selectedDays.includes(day)
                                  ? selectedDays.filter((value) => value !== day)
                                  : [...selectedDays, day].sort((left, right) => left - right);
                                updateSchedule({ weekdays });
                              };
                              return (
                                <TableRow>
                                  <TableCell className="whitespace-nowrap font-medium">{workName(row.sopCode, t)}</TableCell>
                                  <TableCell className="text-sm">
                                    {page.brief.serviceIds.length === 0 ? "—" : (
                                      <span className="block min-w-0">
                                        <span className="block truncate" title={listed(page.brief.serviceIds, names.services)}>
                                          {listed(page.brief.serviceIds, names.services)}
                                        </span>
                                        {page.brief.serviceIds.length > 1 ? (
                                          <span className="mt-1 block text-xs text-muted-foreground">Pilih satu di brief.</span>
                                        ) : null}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">{t("aiEmployee.routine.dailyTitle", "Harian")}</TableCell>
                                  <TableCell>
                                    <div className="flex w-[13.75rem] flex-nowrap gap-1">
                                      {WEEKDAYS.map((day) => {
                                        const selected = selectedDays.includes(day.value);
                                        return (
                                          <button
                                            key={day.value}
                                            type="button"
                                            aria-pressed={selected}
                                            aria-label={day.label}
                                            title={day.label}
                                            disabled={!canEdit || saving}
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${selected ? "bg-primary text-primary-foreground" : "border border-input bg-background text-muted-foreground"} disabled:opacity-50`}
                                            onClick={() => toggleDay(day.value)}
                                          >
                                            {day.short}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                  <ContentPlanTiming
                                    times={row.startTimes}
                                    disabled={!canEdit || saving}
                                    onChange={(startTimes) => updateSchedule({ startTimes })}
                                  />
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      aria-label={t("aiEmployee.schedule.active", "Jadwal aktif")}
                                      checked={row.isActive}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateSchedule({ isActive: event.target.checked })}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <span className="truncate">{formatWhen(original?.nextRunAt ?? null, dateLocale)}</span>
                                      {sopRunning || generating ? (
                                        <span
                                          role="status"
                                          title={t("aiEmployee.schedule.running", "Sedang berjalan")}
                                          aria-label={t("aiEmployee.schedule.running", "Sedang berjalan")}
                                          className="inline-flex shrink-0"
                                        >
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                                        </span>
                                      ) : null}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <DropdownMenu
                                      modal={false}
                                      open={planMenuOpen || generating}
                                      onOpenChange={(open) => {
                                        if (!open && generating) return;
                                        setPlanMenuOpen(open);
                                      }}
                                    >
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                          aria-busy={generating}
                                          aria-label={generating
                                            ? t("aiEmployee.schedule.generating", "Membuat plan...")
                                            : t("aiEmployee.jobDesc.action", "Aksi")}
                                        >
                                          {generating
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <MoreHorizontal className="h-4 w-4" />}
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {canEdit ? (
                                          <DropdownMenuItem
                                            disabled={!dirty || saving || generating || !original || dayMissing}
                                            onClick={() => {
                                              if (!original) return;
                                              setScheduleCompare({ before: original, after: row });
                                            }}
                                          >
                                            {t("aiEmployee.schedule.review", "Tinjau jadwal")}
                                          </DropdownMenuItem>
                                        ) : null}
                                        {canEdit ? (
                                          <DropdownMenuItem
                                            disabled={saving}
                                            onSelect={(event) => {
                                              event.preventDefault();
                                              void generatePlanNow();
                                            }}
                                          >
                                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                                            {generating
                                              ? t("aiEmployee.schedule.generating", "Membuat plan...")
                                              : t("aiEmployee.schedule.generateNow", "Generate sekarang")}
                                          </DropdownMenuItem>
                                        ) : null}
                                        <DropdownMenuItem disabled={generating} onClick={() => setBriefPanelOpen(true)}>
                                          {t("aiEmployee.brief.title", "Brief")}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                            {(() => {
                              const row = schedules.find((item) => item.sopCode === "SOP4" && item.cadence === "days") ?? null;
                              if (!row) {
                                return (
                                  <TableRow>
                                    <TableCell className="whitespace-nowrap font-medium">{workName("SOP4", t)}</TableCell>
                                    <TableCell colSpan={8} className="text-muted-foreground">
                                      {t("aiEmployee.story.scheduleMissing", "Jadwal Design Story belum terpasang. Terapkan migrasi shell SOP4.")}
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              const original = page.schedules.find((item) => item.sopCode === "SOP4" && item.cadence === "days") ?? null;
                              const dirty = original ? !sameSchedule(original, row) : false;
                              const selectedDays = row.weekdays;
                              const dayMissing = row.isActive && selectedDays.length === 0;
                              const storyBusy = storyGenerating || sop4Running;
                              const toggleDay = (day: number) => {
                                const weekdays = selectedDays.includes(day)
                                  ? selectedDays.filter((value) => value !== day)
                                  : [...selectedDays, day].sort((left, right) => left - right);
                                updateStorySchedule({ weekdays });
                              };
                              return (
                                <TableRow>
                                  <TableCell className="whitespace-nowrap font-medium">{workName(row.sopCode, t)}</TableCell>
                                  <TableCell className="text-sm">
                                    {page.storyBrief.serviceIds.length === 0 ? "—" : (
                                      <span className="block min-w-0">
                                        <span className="block truncate" title={listed(page.storyBrief.serviceIds, storyNames.services)}>
                                          {listed(page.storyBrief.serviceIds, storyNames.services)}
                                        </span>
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">{t("aiEmployee.routine.dailyTitle", "Harian")}</TableCell>
                                  <TableCell>
                                    <div className="flex w-[13.75rem] flex-nowrap gap-1">
                                      {WEEKDAYS.map((day) => {
                                        const selected = selectedDays.includes(day.value);
                                        return (
                                          <button
                                            key={day.value}
                                            type="button"
                                            aria-pressed={selected}
                                            aria-label={day.label}
                                            title={day.label}
                                            disabled={!canEdit || saving}
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${selected ? "bg-primary text-primary-foreground" : "border border-input bg-background text-muted-foreground"} disabled:opacity-50`}
                                            onClick={() => toggleDay(day.value)}
                                          >
                                            {day.short}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                  <ContentPlanTiming
                                    times={row.startTimes}
                                    disabled={!canEdit || saving}
                                    onChange={(startTimes) => updateStorySchedule({ startTimes })}
                                  />
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      aria-label={t("aiEmployee.schedule.active", "Jadwal aktif")}
                                      checked={row.isActive}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateStorySchedule({ isActive: event.target.checked })}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1 truncate">
                                      {storyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                                      <span className="truncate">{formatWhen(original?.nextRunAt ?? null, dateLocale)}</span>
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <DropdownMenu modal={false}>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                          aria-label={t("aiEmployee.jobDesc.action", "Aksi")}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {canEdit ? (
                                          <DropdownMenuItem
                                            disabled={!dirty || saving || !original || dayMissing}
                                            onClick={() => {
                                              if (!original) return;
                                              setScheduleCompare({ before: original, after: row });
                                            }}
                                          >
                                            {t("aiEmployee.schedule.review", "Tinjau jadwal")}
                                          </DropdownMenuItem>
                                        ) : null}
                                        {canEdit ? (
                                          <DropdownMenuItem
                                            disabled={storyBusy || saving}
                                            onSelect={(event) => {
                                              event.preventDefault();
                                              void generateStoryNow();
                                            }}
                                          >
                                            {storyBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                                            {storyBusy
                                              ? t("aiEmployee.story.generating", "Membuat Story...")
                                              : t("aiEmployee.schedule.generateNow", "Generate sekarang")}
                                          </DropdownMenuItem>
                                        ) : null}
                                        <DropdownMenuItem
                                          disabled={storyBusy}
                                          onClick={() => {
                                            setStoryBrief((current) => current ?? emptyStoryBriefDraft());
                                            setStoryBriefPanelOpen(true);
                                          }}
                                        >
                                          {t("aiEmployee.brief.title", "Brief")}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                            {(() => {
                              const row = reportRoutines.find((item) => item.actionCode === reportCode) ?? reportRoutines[0];
                              if (!row) return null;
                              const saved = page.routines.find((item) => item.actionCode === row.actionCode) ?? null;
                              const next = formatWhen(saved?.nextRunAt ?? null, dateLocale);
                              const sent = formatWhen(saved?.lastSentAt ?? null, dateLocale);
                              const status = routineStatus(saved?.lastStatus ?? null);
                              const selectedDays = row.cadence === "weekly" ? (row.weekday == null ? [] : [row.weekday]) : (row.weekdays ?? []);
                              const blockedDay = row.cadence === "days" ? blockedReportDay(reportRoutines) : null;
                              const dayMissing = row.isActive && (
                                row.cadence === "days"
                                  ? selectedDays.length === 0
                                  : row.cadence === "weekly" && row.weekday == null
                              );
                              const help = row.cadence === "days"
                                ? t("aiEmployee.routine.helpDaily", "Tombol biru adalah hari kerja yang diceritakan. Email berangkat besok pagi pada jam yang dipilih dan berisi hari itu seutuhnya, dari tengah malam sampai tengah malam. Hari mingguan dan tanggal terakhir tidak masuk.")
                                : row.cadence === "weekly"
                                  ? t("aiEmployee.routine.helpWeekly", "Bila hari ini tanggal terakhir dan laporan bulanan aktif, yang terkirim hanya laporan bulanan.")
                                  : t("aiEmployee.routine.helpMonthly", "Pada tanggal terakhir, harian dan mingguan hari itu tidak dikirim. Isinya pekerjaan sejak awal bulan atau kiriman bulanan sebelumnya.");
                              const sentLabel = saved?.lastSentAt && (!saved.lastStatus || saved.lastStatus === "sent")
                                ? `${t("aiEmployee.routine.sent", "Terkirim")} ${sent}`
                                : sent === "—" ? status : `${status} ${sent}`;
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
                                <TableRow>
                                  <TableCell className="whitespace-nowrap font-medium">
                                    {t("aiEmployee.routine.title", "Laporan email")}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                  <TableCell title={help}>
                                    <div className="flex flex-nowrap gap-1">
                                      {reportRoutines.map((item) => {
                                        const picked = item.actionCode === row.actionCode;
                                        return (
                                          <button
                                            key={item.actionCode}
                                            type="button"
                                            aria-pressed={picked}
                                            className={`h-7 shrink-0 rounded-md px-2 text-xs font-medium ${picked ? "bg-primary text-primary-foreground" : "border border-input bg-background text-muted-foreground"}`}
                                            onClick={() => setReportCode(item.actionCode)}
                                          >
                                            {routineTitle(item)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {row.cadence === "monthly" ? (
                                      <span className="inline-flex h-7 w-[13.75rem] items-center whitespace-nowrap text-sm">{runningMonthEnd(dateLocale)}</span>
                                    ) : (
                                      <div className="flex w-[13.75rem] flex-nowrap gap-1">
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
                                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${blocked ? "border border-dashed border-input bg-muted text-muted-foreground" : selected ? "bg-primary text-primary-foreground" : "border border-input bg-background text-muted-foreground"} disabled:opacity-50`}
                                              onClick={() => toggleDay(day.value)}
                                            >
                                              {day.short}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                  <TableCell>
                                    <input
                                      type="time"
                                      aria-label={t("aiEmployee.routine.time", "Jam kirim")}
                                      className="h-8 w-[7.5rem] rounded-md border border-input bg-background px-2 text-sm"
                                      value={row.timeLocal}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateRoutine(row.actionCode, { timeLocal: event.target.value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      aria-label={t("aiEmployee.page.active", "Aktif")}
                                      checked={row.isActive}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => updateRoutine(row.actionCode, { isActive: event.target.checked })}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    <span className="block truncate">{next}</span>
                                    <span className="mt-1 block truncate">{sentLabel}</span>
                                    {saved?.lastError ? <span className="mt-1 block truncate">{saved.lastError}</span> : null}
                                  </TableCell>
                                  <TableCell>
                                    <DropdownMenu modal={false}>
                                      <DropdownMenuTrigger asChild>
                                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t("aiEmployee.jobDesc.action", "Aksi")}>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {canEdit ? (
                                          <DropdownMenuItem
                                            disabled={saving || dayMissing || (saved ? sameRoutine(saved, row) : false)}
                                            onClick={() => setRoutineCompare({ before: saved, after: row })}
                                          >
                                            {t("aiEmployee.routine.reviewShort", "Tinjau")}
                                          </DropdownMenuItem>
                                        ) : null}
                                        <DropdownMenuItem onClick={() => setRecipientsOpen(true)}>
                                          {t("aiEmployee.routine.recipientColumn", "Penerima")}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                          </TableBody>
                        </Table>
                        <Dialog open={recipientsOpen} onOpenChange={setRecipientsOpen}>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{t("aiEmployee.routine.recipientColumn", "Penerima")}</DialogTitle>
                              <DialogDescription>{t("aiEmployee.routine.title", "Laporan email")}</DialogDescription>
                            </DialogHeader>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-40">{t("aiEmployee.routine.recipientColumn", "Penerima")}</TableHead>
                                  <TableHead>{t("aiEmployee.routine.addressColumn", "Alamat")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell>{t("aiEmployee.routine.primaryLabel", "Utama")}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {page.routines.find((item) => item.reviewerEmail)?.reviewerEmail || t("aiEmployee.routine.noEmail", "belum ada email")}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>{t("aiEmployee.routine.copyEmail1", "Email tambahan 1")}</TableCell>
                                  <TableCell>
                                    <input
                                      type="email"
                                      aria-label={t("aiEmployee.routine.copyEmail1", "Email tambahan 1")}
                                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      value={copyEmail1}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => setCopyEmail1(event.target.value)}
                                    />
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>{t("aiEmployee.routine.copyEmail2", "Email tambahan 2")}</TableCell>
                                  <TableCell>
                                    <input
                                      type="email"
                                      aria-label={t("aiEmployee.routine.copyEmail2", "Email tambahan 2")}
                                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      value={copyEmail2}
                                      disabled={!canEdit || saving}
                                      onChange={(event) => setCopyEmail2(event.target.value)}
                                    />
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            {canEdit ? (
                              <DialogFooter>
                                <Button
                                  type="button"
                                  disabled={saving || (copyEmail1.trim() === (page.summary.reportCopyEmail1 ?? "") && copyEmail2.trim() === (page.summary.reportCopyEmail2 ?? ""))}
                                  onClick={() => void confirmCopies()}
                                >
                                  {t("aiEmployee.routine.saveCopies", "Simpan email")}
                                </Button>
                              </DialogFooter>
                            ) : null}
                          </DialogContent>
                        </Dialog>

                        <AiEmployeeBriefPanel
                          open={briefPanelOpen}
                          onOpenChange={setBriefPanelOpen}
                          page={page}
                          brief={brief}
                          setBrief={setBrief}
                                  canEdit={canEdit}
                                  saving={saving}
                          names={names}
                          visiblePillars={visiblePillars}
                          visibleProducts={visibleProducts}
                          pillarUsage={pillarUsage}
                          workName={workName("SOP1", t)}
                          t={t}
                          onReview={() => setBriefOpen(true)}
                          onOpenAngle={setAngleDetailId}
                          generating={generating}
                          onGenerateNow={() => {
                            setBriefPanelOpen(false);
                            void generatePlanNow();
                          }}
                          saveReference={model.saveReference}
                          clearReference={model.clearReference}
                          saveCatalogColor={model.saveCatalogColor}
                          selectCatalogColor={model.selectCatalogColor}
                          deleteCatalogColor={model.deleteCatalogColor}
                          saveCatalogLogo={model.saveCatalogLogo}
                          selectCatalogLogo={model.selectCatalogLogo}
                          deleteCatalogLogo={model.deleteCatalogLogo}
                        />

                        {storyBrief ? (
                          <AiEmployeeStoryBriefPanel
                            open={storyBriefPanelOpen}
                            onOpenChange={setStoryBriefPanelOpen}
                            page={page}
                            brief={storyBrief}
                            setBrief={setStoryBrief}
                                    canEdit={canEdit}
                                    saving={saving}
                            names={storyNames}
                            visiblePillars={visibleStoryPillars}
                            pillarUsage={storyPillarUsage}
                            workName={workName("SOP4", t)}
                            t={t}
                            onReview={() => setStoryBriefOpen(true)}
                            onOpenAngle={setAngleDetailId}
                            saveCatalogColor={model.saveStoryCatalogColor}
                            selectCatalogColor={model.selectStoryCatalogColor}
                            deleteCatalogColor={model.deleteStoryCatalogColor}
                          />
                                ) : null}
                      </section>

                      {employeeId ? <AiEmployeeRunLog employeeId={employeeId} /> : null}
                      {employeeId ? <AiEmployeeStoryPlansTable employeeId={employeeId} /> : null}

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

      <Dialog open={storyBriefOpen} onOpenChange={setStoryBriefOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("aiEmployee.story.compareTitle", "Brief Design Story lama dan baru")}</DialogTitle>
            <DialogDescription>
              {t("aiEmployee.story.compareHelp", "Periksa perubahan Design Story sebelum disimpan. Brief carousel tidak ikut berubah.")}
            </DialogDescription>
          </DialogHeader>
          <ChangeTable rows={pendingStoryBrief} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setStoryBriefOpen(false)}>
              {t("aiEmployee.page.cancel", "Batal")}
            </Button>
            <Button type="button" disabled={saving || pendingStoryBrief.length === 0} onClick={() => void confirmStoryBrief()}>
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
                  before: scheduleCompare.before.weekdays.map((day) => WEEKDAYS.find((item) => item.value === day)?.label ?? "—").join(", ") || "—",
                  after: scheduleCompare.after.weekdays.map((day) => WEEKDAYS.find((item) => item.value === day)?.label ?? "—").join(", ") || "—",
                },
                {
                  label: t("aiEmployee.schedule.frequency", "Frekuensi"),
                  before: [...scheduleCompare.before.startTimes].sort().join(", ") || "—",
                  after: [...scheduleCompare.after.startTimes].sort().join(", ") || "—",
                },
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

      <AngleDetailDialog
        angle={page?.options.angles.find((item) => item.id === angleDetailId) ?? null}
        onClose={() => setAngleDetailId(null)}
      />

      <ThinkingLabQueueBlockedDialog
        open={queueBlockReason != null}
        reason={queueBlockReason}
        onOpenChange={(open) => {
          if (!open) setQueueBlockReason(null);
        }}
        onOpenThinkingLab={openThinkingLabFromQueueBlock}
      />

      <CarouselExecutionCheckProgressDialog
        progress={executionProgress}
        onOpenChange={(open) => {
          if (!open) setExecutionProgress(null);
          else setExecutionProgress((current) => (current ? { ...current, open: true } : current));
        }}
      />
    </div>
  );
}
