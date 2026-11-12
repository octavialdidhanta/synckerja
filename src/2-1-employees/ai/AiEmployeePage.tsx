import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, Loader2, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
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
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useToast } from "@/shared/hooks/use-toast";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { AiEmployeePageSkeleton } from "./AiEmployeePageSkeleton";
import { ReferenceField } from "./ReferenceField";
import { CatalogColorField, CatalogLogoField } from "./CatalogAssetsFields";
import {
  briefChanges,
  classifyAiEmployeeError,
  sameBrief,
  sameIds,
  sameRoutine,
  sameSchedule,
} from "./parse";
import { anglesForCatalogs, anglesWithLockedIdeas, pillarsForLockedIdeas } from "./angleCatalog";
import { canAddScheduleTime } from "./scheduleTimes";
import type { AngleOption, BriefChange, BriefDraft, CatalogOption, RoutineRow, ScheduleRow } from "./types";
import { useSubCategoryPhotoUrls } from "./subCategoryPhotos";
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
  if (code === "CHAT") return label("aiEmployee.work.chat", "Percakapan");
  return code || "—";
}

function listed(ids: string[], names: Map<string, string>): string {
  const labels = ids.map((id) => names.get(id)).filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(", ") : "—";
}

function shownText(value: string): string {
  const text = value.trim();
  return text || "—";
}

function angleCodeLabel(angle: { code: string; label: string }): string {
  const code = angle.code.trim();
  return code ? `Angle - ${code}` : angle.label;
}

function AngleDetailDialog({
  angle,
  onClose,
}: {
  angle: AngleOption | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={angle != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[min(28rem,70vh,92vw)] w-[min(28rem,70vh,92vw)] max-w-none flex-col gap-3 overflow-hidden p-5 sm:max-w-none">
        {angle ? (
          <>
            <DialogHeader className="shrink-0 pr-10">
              <DialogTitle>{angleCodeLabel(angle)}</DialogTitle>
              <DialogDescription>{angle.name || angle.master || "Angle"}</DialogDescription>
            </DialogHeader>
            <DialogFormScrollArea className="pr-1">
              <div className="space-y-3 pb-1 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Master Thought</p>
                <p className="whitespace-pre-wrap">{angle.master || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Angle</p>
                <p className="whitespace-pre-wrap">{angle.statement || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Idea</p>
                {angle.ideas.length === 0 ? (
                  <p className="text-muted-foreground">Belum ada idea yang locked.</p>
                ) : (
                  <ul className="space-y-2">
                    {angle.ideas.map((idea) => (
                      <li key={idea.id}>
                        <p className="font-medium">{idea.code ? `${idea.code} · ${idea.name}` : idea.name}</p>
                        {idea.statement ? <p className="whitespace-pre-wrap text-muted-foreground">{idea.statement}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {angle.otherIdeaCount > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">{angle.otherIdeaCount} idea lain belum locked.</p>
                ) : null}
              </div>
              </div>
            </DialogFormScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AngleFocusField({
  emptyLabel,
  options,
  catalogIds,
  value,
  disabled,
  onChange,
  onOpen,
}: {
  emptyLabel: string;
  options: AngleOption[];
  catalogIds: string[];
  value: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is AngleOption => Boolean(option));
  const needle = query.trim().toLowerCase();
  const visible = anglesWithLockedIdeas(anglesForCatalogs(options, catalogIds)).filter((option) => {
    if (!needle) return true;
    return angleCodeLabel(option).toLowerCase().includes(needle);
  });
  return (
    <Popover open={open} onOpenChange={(next) => { if (!disabled) setOpen(next); }}>
      <PopoverTrigger asChild>
        <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
          {selected.map((angle) => {
            const chip = angleCodeLabel(angle);
            return (
              <span
                key={angle.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900"
              >
                <button
                  type="button"
                  className="truncate"
                  title={angle.name || undefined}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(angle.id);
                  }}
                >
                  {chip}
                </button>
                {!disabled ? (
                <button
                  type="button"
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-violet-700 hover:bg-violet-200"
                  aria-label={`Hapus ${chip}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((id) => id !== angle.id));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
                ) : null}
              </span>
            );
          })}
          {!disabled ? (
            <input
              value={query}
              placeholder={selected.length === 0 ? "Angle" : ""}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="h-7 min-w-[5rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          ) : selected.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="scrollbar-hide max-h-60 w-56 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onOpenAutoFocus={(event) => event.preventDefault()}>
        {visible.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          visible.map((option) => {
            const picked = value.includes(option.id);
            const blocked = !picked && value.length >= 3;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled || blocked}
                title={option.name || undefined}
                className={cn(
                  "flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                  picked && "bg-violet-50",
                )}
                onClick={() => {
                  if (picked) onChange(value.filter((id) => id !== option.id));
                  else if (value.length < 3) onChange([...value, option.id]);
                  setQuery("");
                }}
              >
                {angleCodeLabel(option)}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

function ProductKnowledgeField({
  emptyLabel,
  placeholder,
  limit = 12,
  options,
  value,
  disabled,
  onChange,
}: {
  emptyLabel: string;
  placeholder: string;
  limit?: number;
  options: CatalogOption[];
  value: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is CatalogOption => Boolean(option));
  const needle = query.trim().toLowerCase();
  const visible = options.filter((option) => {
    if (!needle) return true;
    return option.label.toLowerCase().includes(needle);
  });
  return (
    <Popover open={open} onOpenChange={(next) => { if (!disabled) setOpen(next); }}>
      <PopoverTrigger asChild>
        <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
          {selected.map((product) => (
            <span
              key={product.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900"
            >
              <span className="truncate" title={product.label}>{product.label}</span>
              {!disabled ? (
                <button
                  type="button"
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-violet-700 hover:bg-violet-200"
                  aria-label={`Hapus ${product.label}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((id) => id !== product.id));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
          {!disabled ? (
            <input
              value={query}
              placeholder={selected.length === 0 ? placeholder : ""}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="h-7 min-w-[5rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          ) : selected.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="scrollbar-hide z-[60] max-h-[min(16rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto overscroll-contain p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        {visible.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          visible.map((option) => {
            const picked = value.includes(option.id);
            const blocked = !picked && value.length >= limit;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled || blocked}
                className={cn(
                  "flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                  picked && "bg-violet-50",
                )}
                onClick={() => {
                  if (picked) onChange(value.filter((id) => id !== option.id));
                  else if (value.length < limit) onChange([...value, option.id]);
                  setQuery("");
                }}
              >
                {option.label}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

function FieldHint({ text, label, wide = false }: { text: string; label: string; wide?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-serif italic leading-none text-muted-foreground hover:text-foreground"
          aria-label={`Keterangan ${label}`}
        >
          i
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className={cn("z-[60] p-0", wide ? "w-96" : "w-72")}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto overflow-x-hidden whitespace-pre-line p-3 text-sm leading-relaxed [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {text}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RepeatVoiceEditor({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.trim();
    if (!next || next.length > 500 || value.includes(next) || value.length >= 3) return;
    onChange([...value, next]);
    setDraft("");
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-7">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 p-3">
        {value.map((voice) => (
          <div key={voice} className="flex items-start justify-between gap-2 text-sm">
            <span className="whitespace-pre-wrap">{voice}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={disabled}
              onClick={() => onChange(value.filter((item) => item !== voice))}
            >
              Hapus
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={draft}
            maxLength={500}
            disabled={disabled || value.length >= 3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button type="button" size="sm" variant="outline" disabled={disabled || value.length >= 3} onClick={add}>
            Tambah
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SubCategoryField({
  organizationId,
  ready,
  canEdit,
  saving,
  value,
  options,
  onChange,
}: {
  organizationId: string;
  ready: boolean;
  canEdit: boolean;
  saving: boolean;
  value: string[];
  options: Array<{ id: string; name: string; hasLibraryPhoto: boolean }>;
  onChange: (ids: string[]) => void;
}) {
  const photoUrls = useSubCategoryPhotoUrls(
    organizationId,
    options.filter((option) => option.hasLibraryPhoto).map((option) => option.id),
  );
  const selected = options.filter((option) => value.includes(option.id));
  const summary = selected.length > 0 ? selected.map((option) => option.name).join(", ") : "General Content";
  const withPhoto = selected.filter((option) => option.hasLibraryPhoto);
  if (!ready) return <span className="text-sm text-muted-foreground">Simpan katalog dulu.</span>;
  if (!canEdit) return <span>{summary}</span>;
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    if (value.length >= 8) return;
    onChange([...value, id]);
  };
  return (
    <div className="space-y-1">
      <Popover modal>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={saving ? -1 : 0}
            aria-label="Sub Category"
            aria-disabled={saving}
            className={cn(
              "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-left",
              saving && "pointer-events-none opacity-50",
            )}
          >
            {selected.length === 0 ? (
              <span className="px-1 text-sm text-muted-foreground">General Content</span>
            ) : selected.map((option) => (
              <span
                key={option.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900"
              >
                <span className="truncate" title={option.name}>{option.name}</span>
                <button
                  type="button"
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-violet-700 hover:bg-violet-200"
                  aria-label={`Hapus ${option.name}`}
                  disabled={saving}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((id) => id !== option.id));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="scrollbar-hide z-[60] max-h-[min(16rem,var(--radix-popover-content-available-height))] w-96 overflow-y-auto overscroll-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <label className="flex cursor-pointer items-center gap-2 border-b border-border px-2 py-1.5 text-sm hover:bg-muted">
            <input
              type="checkbox"
              className="shrink-0"
              checked={value.length === 0}
              disabled={saving}
              onChange={() => onChange([])}
            />
            <span className="min-w-0 flex-1">General Content</span>
            <span className="h-10 w-10 shrink-0" aria-hidden />
          </label>
          {options.map((option, index) => {
            const photoUrl = photoUrls[option.id];
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted",
                  index < options.length - 1 && "border-b border-border",
                )}
              >
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={value.includes(option.id)}
                  disabled={saving || (!value.includes(option.id) && value.length >= 8)}
                  onChange={() => toggle(option.id)}
                />
                <span className="min-w-0 flex-1">{option.name}</span>
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="h-10 w-10 shrink-0" aria-hidden />
                )}
              </label>
            );
          })}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && withPhoto.length === 0 ? (
        <p className="text-xs text-muted-foreground">Pilihan ini belum punya foto di product list.</p>
      ) : null}
    </div>
  );
}

function CatalogSelect({
  label,
  emptyLabel,
  options,
  value,
  disabled,
  onChoose,
}: {
  label: string;
  emptyLabel: string;
  options: CatalogOption[];
  value: string[];
  disabled: boolean;
  onChoose: (id: string | null) => void;
}) {
  const selected = options.filter((option) => value.includes(option.id));
  const summary = selected.length > 0 ? selected.map((option) => option.label).join(", ") : label;
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-7">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="scrollbar-hide z-[60] max-h-[min(16rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto overscroll-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        {options.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          options.map((option) => {
            const picked = value.length === 1 && value[0] === option.id;
            return (
              <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="radio"
                  className="mt-1"
                  name="ai-employee-catalog"
                  checked={picked}
                  disabled={disabled}
                  onClick={() => onChoose(picked ? null : option.id)}
                />
                <span>{option.label}</span>
              </label>
            );
          })
        )}
        {selected.length > 1 ? (
          <p className="px-2 pt-2 text-xs text-muted-foreground">{summary}. Pilih satu.</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PersonaField({
  canEdit,
  saving,
  value,
  options,
  labels,
  emptyLabel,
  onChange,
}: {
  canEdit: boolean;
  saving: boolean;
  value: string[];
  options: CatalogOption[];
  labels: Map<string, string>;
  emptyLabel: string;
  onChange: (ids: string[]) => void;
}) {
  const selected = value
    .map((id) => {
      const label = labels.get(id) ?? options.find((option) => option.id === id)?.label;
      return label ? { id, label } : null;
    })
    .filter((option): option is { id: string; label: string } => option != null);
  if (!canEdit) return <span>{selected.length > 0 ? selected.map((option) => option.label).join(", ") : "—"}</span>;
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={saving ? -1 : 0}
          aria-label="Persona"
          aria-disabled={saving}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-left",
            saving && "pointer-events-none opacity-50",
          )}
        >
          {selected.length === 0 ? (
            <span className="px-1 text-sm text-muted-foreground">—</span>
          ) : selected.map((option) => (
            <span
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900"
            >
              <span className="truncate" title={option.label}>{option.label}</span>
              <button
                type="button"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-violet-700 hover:bg-violet-200"
                aria-label={`Hapus ${option.label}`}
                disabled={saving}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((id) => id !== option.id));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="scrollbar-hide z-[60] max-h-[min(16rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto overscroll-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        {options.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={value.includes(option.id)}
                disabled={saving}
                onChange={() => toggle(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function TextFieldButton({
  label,
  value,
  maxLength,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7" disabled={disabled}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <textarea
          aria-label={label}
          className="min-h-24 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
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
  const [angleDetailId, setAngleDetailId] = useState<string | null>(null);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [scheduleCompare, setScheduleCompare] = useState<{ before: ScheduleRow; after: ScheduleRow } | null>(null);
  const [routineCompare, setRoutineCompare] = useState<{ before: RoutineRow | null; after: RoutineRow } | null>(null);
  const [reportCode, setReportCode] = useState("work_report.daily");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const generatingRef = useRef(false);
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

  useEffect(() => {
    if (!page || !brief || brief.angleIds.length === 0) return;
    const allowed = new Set(
      page.options.angles
        .filter((angle) => brief.angleIds.includes(angle.id))
        .flatMap((angle) => angle.pillarIds),
    );
    if (brief.pillarIds.every((id) => allowed.has(id))) return;
    setBrief({ ...brief, pillarIds: brief.pillarIds.filter((id) => allowed.has(id)) });
  }, [page, brief]);

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

  const generatePlanNow = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const result = await model.generateNow();
      toast({
        title: result.planCount > 0
          ? t("aiEmployee.schedule.generated", "Plan dibuat")
          : t("aiEmployee.schedule.generatedEmpty", "Tidak ada plan baru"),
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
      const description = raw.includes("too_soon")
        ? t("aiEmployee.schedule.tooSoon", "Plan sebelumnya masih dibuat. Tunggu sampai selesai.")
        : raw.includes("catalog_limit")
          ? t("aiEmployee.schedule.catalogLimit", "Pilih satu katalog di brief.")
          : raw.includes("brief_missing")
          ? t("aiEmployee.schedule.briefMissing", "Isi katalog pada brief terlebih dahulu.")
          : raw.includes("forbidden")
            ? t("aiEmployee.page.ownerOnly", "Hanya owner yang dapat mengubah data ini.")
            : t("aiEmployee.schedule.generateFailed", "Plan tidak dibuat.");
      toast({ title: t("aiEmployee.schedule.generateFailed", "Plan tidak dibuat."), description, variant: "destructive" });
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      setPlanMenuOpen(false);
    }
  };

  const visiblePillars = page && brief
    ? pillarsForLockedIdeas(page.options.pillars, page.options.angles, brief.angleIds)
    : [];

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
                                    <span className="block truncate">{formatWhen(original?.nextRunAt ?? null, dateLocale)}</span>
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

                        <Dialog open={briefPanelOpen} onOpenChange={setBriefPanelOpen}>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {t("aiEmployee.brief.title", "Brief")}
                                <FieldHint
                                  wide
                                  label={t("aiEmployee.brief.title", "Brief")}
                                  text={"Berlaku untuk Content Plan Carousel. Field yang diisi menjadi batas. Field yang dikosongkan melepas batas itu.\n\nKatalog paling banyak satu. Kosong berarti plan tidak dibuat. Satu katalog untuk karyawan ini. Katalog lain membutuhkan karyawan AI baru.\n\nFokus angle kosong: tidak ada giliran angle. Idea yang dikunci dan lolos dari angle mana pun ikut. Yang belum punya plan didahulukan. Setelah semua idea punya plan, giliran tetap merata: jumlah plan paling sedikit, lalu yang paling lama tidak dipakai. Idea dan pilar plan terakhir dilewati selama masih ada pilihan. Angle ikut terbawa dari idea.\nFokus angle diisi: giliran menjauh dari plan organisasi yang tanggal postingnya paling baru. Angle yang paling lama tidak keluar didahulukan, dan angle plan terakhir dilewati selama angle lain masih punya idea yang lolos. Idea di angle itu dipilih yang jumlah plannya paling sedikit, lalu yang paling lama tidak dipakai. Idea plan terakhir tidak diulang selama masih ada idea lain yang jumlahnya sama atau lebih sedikit. Idea yang sama boleh kembali lewat pilar yang belum pernah dipasangkan. Persona dan audiens tidak dikirim.\n\nPilar kosong: pilar diambil dari pilar aktif di Content Pillar Tracker. Yang paling sedikit dipakai pada bulan berjalan didahulukan. Pilar plan terakhir dilewati selama masih ada pilar lain yang belum dipasangkan dengan idea itu.\nPilar diisi: giliran hanya di dalam daftar itu, dengan urutan yang sama.\nPasangan idea dan pilar yang sama tidak dibuat dua kali.\n\nProduct Knowledge kosong: daftarnya semua baris yang kategorinya sama dengan katalog.\nProduct Knowledge diisi: hanya baris itu.\nSaat fokus angle terisi, Naya memilih dari daftar itu (paling banyak 30) dan pilihannya dipakai selama ada di daftar.\nSaat fokus angle kosong, yang dikirim paling banyak 3 baris, dan baris yang sudah terpakai dilewati.\n\nReferensi kosong: tidak ada arahan gambar. Satu gambar dipakai di semua slide. Lebih dari satu, Naya memilih satu nomor untuk semua slide. Tempel tersimpan langsung dan tidak lewat tinjau brief.\n\nSuara kosong: tidak ada gaya bahasa.\nCatatan wajib adalah instruksi. Caption dan teks slide terakhir memenuhi maksudnya. Nomor telepon, harga, atau fakta lain di dalam instruksi itu yang muncul, lalu ikut ke Canva. Kalimat instruksinya tidak disalin.\nCatatan terlarang tidak boleh muncul di judul, caption, concept, visual, teks, atau element, dan ikut sebagai larangan ke Canva.\nBila adegan memuat orang, gambar diminta sebagai foto manusia sungguhan, bukan ilustrasi.\nGaya pengulangan kosong: tidak ada plan kedua. Gaya pertama dipakai hanya setelah plan pertama tayang lebih dari 7 hari dan metriknya di atas median."}
                                />
                              </DialogTitle>
                              <DialogDescription>{workName("SOP1", t)}</DialogDescription>
                            </DialogHeader>
                        <Table containerClassName="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[60vh] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-40">{t("aiEmployee.jobDesc.part", "Bagian")}</TableHead>
                              <TableHead>{t("aiEmployee.jobDesc.value", "Isi")}</TableHead>
                              {canEdit ? <TableHead className="w-24" /> : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {([
                              {
                                key: "services",
                                label: t("aiEmployee.brief.services", "Katalog"),
                                hint: brief.serviceIds.length > 1
                                  ? "Masih ada lebih dari satu katalog. Pilih satu sebelum menyimpan."
                                  : "Satu katalog untuk karyawan ini. Katalog lain membutuhkan karyawan AI baru.",
                                value: listed(brief.serviceIds, names.services),
                                editor: (
                                  <CatalogSelect
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    emptyLabel={t("aiEmployee.brief.noServices", "Tidak ada katalog")}
                                    options={page.options.services}
                                    value={brief.serviceIds}
                                    disabled={saving}
                                    onChoose={(id) => setBrief((current) => {
                                      if (!current) return current;
                                      const serviceIds = id == null ? [] : [id];
                                      const allowed = new Set(serviceIds);
                                      const productIds = current.productIds.filter((productId) => {
                                        const product = page.options.products.find((item) => item.id === productId);
                                        return product?.serviceId != null && allowed.has(product.serviceId);
                                      });
                                      const angleIds = current.angleIds.filter((angleId) => {
                                        const angle = page.options.angles.find((item) => item.id === angleId);
                                        return angle?.serviceId != null && allowed.has(angle.serviceId);
                                      });
                                      const pillarAllowed = new Set(
                                        page.options.angles
                                          .filter((angle) => angleIds.includes(angle.id))
                                          .flatMap((angle) => angle.pillarIds),
                                      );
                                      return {
                                        ...current,
                                        serviceIds,
                                        subServiceId: null,
                                        subServiceIds: [],
                                        productIds,
                                        angleIds,
                                        pillarIds: current.pillarIds.filter((pillarId) => pillarAllowed.has(pillarId)),
                                      };
                                    })}
                                  />
                                ),
                              },
                              {
                                key: "subCategory",
                                label: t("aiEmployee.brief.subCategory", "Sub Category"),
                                hint: "Bisa lebih dari satu, paling banyak 8. Kosong berarti General Content. Foto product list dari yang dipilih dikirim ke Canva. Menghapus plan tidak menghapus produk.",
                                value: <SubCategoryField
                                  organizationId={page.organizationId}
                                  ready={sameIds(page.brief.serviceIds, brief.serviceIds) && brief.serviceIds.length === 1}
                                  canEdit={canEdit}
                                  saving={saving}
                                  value={brief.subServiceIds}
                                  options={page.subServices.filter((item) => item.serviceId === brief.serviceIds[0])}
                                  onChange={(subServiceIds) => setBrief((current) => current ? { ...current, subServiceIds, subServiceId: subServiceIds[0] ?? null } : current)}
                                />,
                                editor: null,
                              },
                              {
                                key: "angles",
                                label: t("aiEmployee.brief.angles", "Fokus angle"),
                                value: (
                                  <AngleFocusField
                                    emptyLabel={t("aiEmployee.brief.noAngles", "Tidak ada angle")}
                                    options={page.options.angles}
                                    catalogIds={brief.serviceIds}
                                    value={brief.angleIds}
                                    disabled={saving || !canEdit}
                                    onChange={(angleIds) => setBrief((current) => {
                                      if (!current || !page) return current;
                                      if (angleIds.length === 0) return { ...current, angleIds, pillarIds: [] };
                                      const allowed = new Set(
                                        page.options.angles
                                          .filter((angle) => angleIds.includes(angle.id))
                                          .flatMap((angle) => angle.pillarIds),
                                      );
                                      return {
                                        ...current,
                                        angleIds,
                                        pillarIds: current.pillarIds.filter((id) => allowed.has(id)),
                                      };
                                    })}
                                    onOpen={setAngleDetailId}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "pillars",
                                label: t("aiEmployee.brief.pillars", "Pilar"),
                                value: (
                                  <ProductKnowledgeField
                                    placeholder={t("aiEmployee.brief.pillars", "Pilar")}
                                    emptyLabel={brief.angleIds.length === 0
                                      ? t("aiEmployee.brief.pickAngleFirst", "Pilih angle dulu")
                                      : t("aiEmployee.brief.noLockedPillars", "Tidak ada pilar yang terkunci pada idea")}
                                    options={page.options.pillars.filter((pillar) => (
                                      visiblePillars.some((item) => item.id === pillar.id) || brief.pillarIds.includes(pillar.id)
                                    ))}
                                    value={brief.pillarIds}
                                    disabled={saving || !canEdit || brief.angleIds.length === 0}
                                    onChange={(pillarIds) => setBrief((current) => current ? { ...current, pillarIds } : current)}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "personas",
                                label: t("aiEmployee.brief.personas", "Persona"),
                                value: (
                                  <PersonaField
                                    canEdit={canEdit}
                                    saving={saving}
                                    value={brief.personaIds}
                                    options={page.options.personas}
                                    labels={names.personas}
                                    emptyLabel={t("aiEmployee.brief.noPersonas", "Tidak ada persona")}
                                    onChange={(personaIds) => setBrief((current) => current ? { ...current, personaIds } : current)}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "products",
                                label: t("aiEmployee.brief.products", "Product Knowledge"),
                                value: (
                                  <ProductKnowledgeField
                                    placeholder={t("aiEmployee.brief.products", "Product Knowledge")}
                                    emptyLabel={brief.serviceIds.length === 0
                                      ? t("aiEmployee.brief.pickServiceFirst", "Pilih katalog dulu")
                                      : t("aiEmployee.brief.noProducts", "Tidak ada Product Knowledge untuk katalog ini")}
                                    options={visibleProducts}
                                    value={brief.productIds}
                                    disabled={saving || !canEdit || brief.serviceIds.length === 0}
                                    onChange={(productIds) => setBrief((current) => current ? { ...current, productIds } : current)}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "references",
                                label: t("aiEmployee.brief.references", "Referensi layout"),
                                hint: "Canva hanya memakai gambar ini sebagai referensi layout. Warna tidak diambil dari gambar ini.\n\nKlik kotak, lalu tempel gambar. Satu gambar dipakai. Lebih dari satu, Naya memilih satu.",
                                value: (
                                  <ReferenceField
                                    references={page.references}
                                    canEdit={canEdit}
                                    onSave={model.saveReference}
                                    onClear={model.clearReference}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "colors",
                                label: t("aiEmployee.brief.colors", "Referensi warna"),
                                value: (
                                  <CatalogColorField
                                    blocked={page.brief.serviceIds.length === 1
                                      ? (sameIds(page.brief.serviceIds, brief.serviceIds) ? null : "Simpan katalog dulu.")
                                      : "Pilih satu katalog dulu."}
                                    canEdit={canEdit}
                                    colors={page.brandColors}
                                    selectedId={page.brandColorId}
                                    onSave={model.saveCatalogColor}
                                    onSelect={model.selectCatalogColor}
                                    onDelete={model.deleteCatalogColor}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "logo",
                                label: t("aiEmployee.brief.logo", "Company logo"),
                                value: (
                                  <CatalogLogoField
                                    blocked={page.brief.serviceIds.length === 1
                                      ? (sameIds(page.brief.serviceIds, brief.serviceIds) ? null : "Simpan katalog dulu.")
                                      : "Pilih satu katalog dulu."}
                                    canEdit={canEdit}
                                    logos={page.companyLogos}
                                    selectedId={page.companyLogoId}
                                    onSave={model.saveCatalogLogo}
                                    onSelect={model.selectCatalogLogo}
                                    onDelete={model.deleteCatalogLogo}
                                  />
                                ),
                                editor: null,
                              },
                              {
                                key: "audience",
                                label: t("aiEmployee.brief.audience", "Audiens"),
                                value: shownText(brief.audience),
                                editor: (
                                  <TextFieldButton
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    value={brief.audience}
                                    maxLength={1000}
                                    disabled={saving}
                                    onChange={(audience) => setBrief((current) => current ? { ...current, audience } : current)}
                                  />
                                ),
                              },
                              {
                                key: "repeatVoices",
                                label: t("aiEmployee.brief.repeatVoices", "Gaya pengulangan"),
                                hint: "Hanya untuk plan kedua pada idea dan pilar yang sama, setelah plan pertama tayang lebih dari 7 hari dan metriknya di atas median. Yang dipakai hanya gaya pertama. Kosong berarti tidak ada pengulangan.",
                                value: brief.repeatVoices.length > 0 ? brief.repeatVoices.join("\n") : "—",
                                editor: (
                                  <RepeatVoiceEditor
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    value={brief.repeatVoices}
                                    disabled={saving}
                                    onChange={(repeatVoices) => setBrief((current) => current ? { ...current, repeatVoices } : current)}
                                  />
                                ),
                              },
                              {
                                key: "voice",
                                label: t("aiEmployee.brief.voice", "Suara"),
                                hint: "Nada tulisan plan pertama. Naya memakai ini sebagai gaya bahasa.",
                                value: shownText(brief.voice),
                                editor: (
                                  <TextFieldButton
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    value={brief.voice}
                                    maxLength={1000}
                                    disabled={saving}
                                    onChange={(voice) => setBrief((current) => current ? { ...current, voice } : current)}
                                  />
                                ),
                              },
                              {
                                key: "required",
                                label: t("aiEmployee.brief.required", "Catatan wajib"),
                                hint: "Instruksi untuk plan, misalnya cantumkan nomor telepon atau harga. Yang masuk ke plan adalah faktanya. Kosong berarti tidak ada instruksi.",
                                value: shownText(brief.requiredNotes),
                                editor: (
                                  <TextFieldButton
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    value={brief.requiredNotes}
                                    maxLength={2000}
                                    disabled={saving}
                                    onChange={(requiredNotes) => setBrief((current) => current ? { ...current, requiredNotes } : current)}
                                  />
                                ),
                              },
                              {
                                key: "forbidden",
                                label: t("aiEmployee.brief.forbidden", "Catatan terlarang"),
                                hint: "Hal yang tidak boleh muncul di plan. Kosong berarti tidak ada larangan.",
                                value: shownText(brief.forbiddenNotes),
                                editor: (
                                  <TextFieldButton
                                    label={t("aiEmployee.brief.edit", "Ubah")}
                                    value={brief.forbiddenNotes}
                                    maxLength={2000}
                                    disabled={saving}
                                    onChange={(forbiddenNotes) => setBrief((current) => current ? { ...current, forbiddenNotes } : current)}
                                  />
                                ),
                              },
                              {
                                key: "autoApprove",
                                label: t("aiEmployee.brief.autoApprove", "Content Plan auto approve"),
                                hint: "Berlaku untuk generate sekarang dan jadwal harian. Plan baru langsung Approved.",
                                value: (
                                  <div className="flex items-center gap-3">
                                    <Switch
                                      checked={brief.contentPlanAutoApprove}
                                      disabled={!canEdit || saving}
                                      onCheckedChange={(checked) => setBrief((current) => current ? { ...current, contentPlanAutoApprove: checked } : current)}
                                      aria-label={t("aiEmployee.brief.autoApprove", "Content Plan auto approve")}
                                    />
                                    <span className="text-sm text-muted-foreground">Plan baru langsung Approved.</span>
                                  </div>
                                ),
                                editor: null,
                              },
                            ] as const).filter((row) => (
                              brief.angleIds.length === 0 || (row.key !== "personas" && row.key !== "audience")
                            )).map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="align-top">
                                  <span className="inline-flex items-center gap-1.5">
                                    {row.label}
                                    {"hint" in row && row.hint ? <FieldHint text={row.hint} label={row.label} /> : null}
                                  </span>
                                </TableCell>
                                {row.key === "angles" || row.key === "products" || row.key === "pillars" || row.key === "references" || row.key === "colors" || row.key === "logo" || row.key === "subCategory" || row.key === "personas" || row.key === "autoApprove" ? (
                                  <TableCell colSpan={canEdit ? 2 : 1} className={row.key === "colors" || row.key === "logo" ? "min-w-0 overflow-hidden" : "whitespace-pre-wrap"}>{row.value}</TableCell>
                                ) : (
                                  <>
                                    <TableCell className="whitespace-pre-wrap">{row.value}</TableCell>
                                    {canEdit ? <TableCell><div className="flex justify-end">{row.editor}</div></TableCell> : null}
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                            {canEdit ? (
                              <DialogFooter>
                                {brief.serviceIds.length > 1 ? (
                                  <p className="mr-auto text-xs text-muted-foreground">Pilih satu katalog sebelum menyimpan.</p>
                                ) : null}
                                <Button
                                  type="button"
                                  disabled={saving || brief.serviceIds.length > 1 || sameBrief(page.brief, brief)}
                                  onClick={() => setBriefOpen(true)}
                                >
                                  {t("aiEmployee.brief.review", "Tinjau brief")}
                                </Button>
                              </DialogFooter>
                            ) : null}
                          </DialogContent>
                        </Dialog>
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
    </div>
  );
}
