import { useState } from "react";
import { Lock, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { anglesForCatalogs, anglesWithLockedIdeas, groupBriefPillars } from "./angleCatalog";
import { MAX_BRIEF_ANGLES } from "./briefAngleFocus";
import { carouselExecutionCheckLines, carouselSystemRulesLines } from "./carouselGenerateRules";
import type { AngleOption, BriefChange, CatalogOption } from "./types";
import { useSubCategoryPhotoUrls } from "./subCategoryPhotos";
import type { PillarFunnel, PillarUsage } from "./pillarUsage";

export function listed(ids: string[], names: Map<string, string>): string {
  const labels = ids.map((id) => names.get(id)).filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(", ") : "—";
}

export function shownText(value: string): string {
  const text = value.trim();
  return text || "—";
}

export function angleCodeLabel(angle: { code: string; label: string }): string {
  const code = angle.code.trim();
  return code ? `Angle - ${code}` : angle.label;
}

export function AngleDetailDialog({
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

export function AngleFocusField({
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
            const blocked = !picked && value.length >= MAX_BRIEF_ANGLES;
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
                  else if (value.length < MAX_BRIEF_ANGLES) onChange([...value, option.id]);
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

export function ProductKnowledgeField({
  emptyLabel,
  placeholder,
  limit = 12,
  options,
  value,
  disabled,
  onChange,
  pillarGroups,
  onOpen,
}: {
  emptyLabel: string;
  placeholder: string;
  limit?: number;
  options: CatalogOption[];
  value: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
  /** Brief pillars: split into locked / used this month / unused, with usage and funnel badges. */
  pillarGroups?: {
    lockedIds: ReadonlySet<string>;
    usage: Readonly<Record<string, PillarUsage>>;
    funnel: Readonly<Record<string, PillarFunnel>>;
    labels: { locked: string; used: string; unused: string; usedTimes: (count: number) => string };
  };
  onOpen?: () => void;
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
  const funnelLabel: Record<PillarFunnel, string> = { top: "TOFU", middle: "MOFU", bottom: "BOFU" };
  const renderOption = (option: CatalogOption, locked: boolean) => {
    const picked = value.includes(option.id);
    const blocked = !picked && value.length >= limit;
    const used = pillarGroups?.usage[option.id];
    const stage = pillarGroups?.funnel[option.id];
    const usedTitle = used && used.count > 0
      ? `${pillarGroups?.labels.usedTimes(used.count)}${used.titles.length > 0 ? `:\n• ${used.titles.join("\n• ")}${used.count > used.titles.length ? "\n• …" : ""}` : ""}`
      : undefined;
    return (
      <button
        key={option.id}
        type="button"
        title={usedTitle}
        disabled={disabled || blocked}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
          picked && "bg-violet-50",
        )}
        onClick={() => {
          if (picked) onChange(value.filter((id) => id !== option.id));
          else if (value.length < limit) onChange([...value, option.id]);
          setQuery("");
        }}
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {stage ? (
          <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">{funnelLabel[stage]}</span>
        ) : null}
        {pillarGroups ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
              used && used.count > 0 ? "bg-sky-100 text-sky-800" : "bg-muted text-muted-foreground",
            )}
            aria-label={pillarGroups.labels.usedTimes(used?.count ?? 0)}
          >
            {used?.count ?? 0}×
          </span>
        ) : null}
        {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Terkunci di idea" /> : null}
      </button>
    );
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        if (next && !open) onOpen?.();
        setOpen(next);
      }}
    >
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
        ) : pillarGroups ? (
          (() => {
            const groups = groupBriefPillars(visible, pillarGroups.lockedIds, pillarGroups.usage);
            const sections = [
              { key: "locked", label: pillarGroups.labels.locked, rows: groups.locked, locked: true },
              { key: "used", label: pillarGroups.labels.used, rows: groups.used, locked: false },
              { key: "unused", label: pillarGroups.labels.unused, rows: groups.unused, locked: false },
            ].filter((section) => section.rows.length > 0);
            return sections.map((section, index) => (
              <div key={section.key}>
                <p
                  className={cn(
                    "px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    index === 0 ? "pt-1.5" : "mt-1 border-t border-border/60 pt-2",
                  )}
                >
                  {section.label} ({section.rows.length})
                </p>
                {section.rows.map((option) => renderOption(option, section.locked))}
              </div>
            ));
          })()
        ) : (
          visible.map((option) => renderOption(option, false))
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FieldHint({ text, label, wide = false }: { text: string; label: string; wide?: boolean }) {
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

export function RepeatVoiceEditor({
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

export function SubCategoryField({
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

export function CatalogSelect({
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

export function PersonaField({
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

export function TextFieldButton({
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

export function ChangeTable({ rows }: { rows: BriefChange[] }) {
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

/** Read-only SOP1 generate gates for Advanced Brief (not toggles). */
export function CarouselSystemRulesPanel() {
  const lines = carouselSystemRulesLines();
  return (
    <div className="space-y-2 py-0.5">
      <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        Selalu aktif
      </span>
      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** Read-only 10 execution check labels (one model call when the brief switch is ON). */
export function CarouselExecutionCheckList() {
  const rows = carouselExecutionCheckLines();
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
      {rows.map((row) => (
        <li key={row.id}>
          <span className="text-foreground">{row.label}</span>
          <span className="text-muted-foreground"> ({row.id})</span>
        </li>
      ))}
    </ul>
  );
}
