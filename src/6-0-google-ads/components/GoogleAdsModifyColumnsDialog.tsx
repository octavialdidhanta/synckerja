import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Minus, Plus, Search, X } from "lucide-react";
import { GoogleAdsImportUiCustomColumnsDialog } from "@/6-0-google-ads/components/GoogleAdsImportUiCustomColumnsDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";
import { modifyColumnsTitle } from "@/google-ads/metrics/googleAdsIdentityColumns";
import type {
  GoogleAdsIdentityColumn,
  GoogleAdsMetricCatalogResponse,
  GoogleAdsMetricEntity,
  GoogleAdsUiCustomColumnItem,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: GoogleAdsMetricEntity;
  catalog: GoogleAdsMetricCatalogResponse | undefined;
  uiCustomColumns?: GoogleAdsUiCustomColumnItem[];
  uiCustomColumnsLoading?: boolean;
  onImportUiCustomColumns?: (names: string[], replaceAll: boolean) => Promise<void>;
  isImportingUiCustomColumns?: boolean;
  selectedKeys: string[];
  columnSets: GoogleAdsColumnSet[];
  onApply: (keys: string[], options?: { saveColumnSetName?: string }) => void | Promise<void>;
  isSaving?: boolean;
};

function uiCustomColumnToMetricItem(col: GoogleAdsUiCustomColumnItem): MetricCatalogItem {
  return {
    key: col.key,
    label: col.label,
    description: col.description,
    entities: ["campaign", "ad_group", "ad", "keyword"],
    valueKind: "count",
    defaultSelected: false,
    sortable: true,
  };
}

function metricMapFromCatalog(
  catalog: GoogleAdsMetricCatalogResponse | undefined,
  uiCustomColumns: GoogleAdsUiCustomColumnItem[] | undefined,
) {
  const map = new Map<string, MetricCatalogItem>();
  for (const m of catalog?.recommended.metrics ?? []) map.set(m.key, m);
  for (const c of catalog?.categories ?? []) {
    for (const m of c.metrics) map.set(m.key, m);
  }
  for (const col of uiCustomColumns ?? []) {
    map.set(col.key, uiCustomColumnToMetricItem(col));
  }
  return map;
}

function MetricCheckboxLabel({
  label,
  description,
  accountLabel,
}: {
  label: string;
  description?: string;
  accountLabel?: string | null;
}) {
  const fullTitle = accountLabel ? `${accountLabel} — ${label}` : label;
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 overflow-hidden">
            {accountLabel ? (
              <span className="block truncate text-xs text-muted-foreground">{accountLabel}</span>
            ) : null}
            <span className="block truncate leading-snug">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm text-xs">
          <p className="font-medium">{fullTitle}</p>
          {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SortableMetricRow({
  metricKey,
  label,
  description,
  onRemove,
}: {
  metricKey: string;
  label: string;
  description?: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: metricKey,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent bg-white px-2 py-1.5 text-sm",
        isDragging && "z-10 border-border shadow-sm",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </TooltipTrigger>
          {description ? (
            <TooltipContent side="left" className="max-w-xs text-xs">
              {description}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function GoogleAdsModifyColumnsDialog({
  open,
  onOpenChange,
  entity,
  catalog,
  uiCustomColumns,
  uiCustomColumnsLoading,
  onImportUiCustomColumns,
  isImportingUiCustomColumns,
  selectedKeys,
  columnSets,
  onApply,
  isSaving,
}: Props) {
  const maxMetrics = catalog?.max_metrics ?? 50;
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftKeys, setDraftKeys] = useState<string[]>(selectedKeys);
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftKeys(selectedKeys);
      setSavePreset(false);
      setPresetName("");
      setSearch("");
      setSearchOpen(false);
    }
  }, [open, selectedKeys]);

  const metricByKey = useMemo(
    () => metricMapFromCatalog(catalog, uiCustomColumns),
    [catalog, uiCustomColumns],
  );
  const draftSet = useMemo(() => new Set(draftKeys), [draftKeys]);

  const identityColumns: GoogleAdsIdentityColumn[] = useMemo(() => {
    if (catalog?.identity_columns?.length) return catalog.identity_columns;
    return [];
  }, [catalog]);

  const leftSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (m: MetricCatalogItem) =>
      !q ||
      m.label.toLowerCase().includes(q) ||
      m.key.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q);

    const recommended = (catalog?.recommended.metrics ?? []).filter(matches);
    const categories = (catalog?.categories ?? [])
      .map((cat) => ({
        ...cat,
        metrics: cat.metrics.filter(matches),
      }))
      .filter((c) => c.metrics.length > 0);
    const matchesUiCustom = (col: GoogleAdsUiCustomColumnItem) =>
      !q ||
      col.label.toLowerCase().includes(q) ||
      col.key.toLowerCase().includes(q) ||
      col.description.toLowerCase().includes(q);

    const custom = (uiCustomColumns ?? []).filter(matchesUiCustom);

    return { recommended, categories, custom };
  }, [catalog, uiCustomColumns, search]);

  const accordionDefaults = useMemo(() => {
    const ids = ["recommended", "custom_columns"];
    for (const c of leftSections.categories) ids.push(c.id);
    return ids;
  }, [leftSections.categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleMetric = (key: string, checked: boolean) => {
    setDraftKeys((prev) => {
      if (checked) {
        if (prev.includes(key) || prev.length >= maxMetrics) return prev;
        return [...prev, key];
      }
      return prev.filter((k) => k !== key);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraftKeys((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleApply = async () => {
    const trimmedName = presetName.trim();
    if (savePreset && !trimmedName) return;
    await onApply(draftKeys, savePreset ? { saveColumnSetName: trimmedName } : undefined);
    onOpenChange(false);
  };

  const loadPreset = (setId: string) => {
    const preset = columnSets.find((s) => s.id === setId);
    if (!preset) return;
    setDraftKeys(preset.metric_keys.filter((k) => metricByKey.has(k)));
  };

  const atLimit = draftKeys.length >= maxMetrics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg font-normal">{modifyColumnsTitle(entity)}</DialogTitle>
            <div className="flex items-center gap-2">
              {searchOpen ? (
                <Input
                  autoFocus
                  placeholder="Search columns"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-48 text-sm"
                  onBlur={() => {
                    if (!search.trim()) setSearchOpen(false);
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Search columns"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-r px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Accordion
              type="multiple"
              defaultValue={accordionDefaults}
              className="w-full space-y-1"
            >
              {leftSections.recommended.length > 0 ? (
                <AccordionItem value="recommended" className="border-none">
                  <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                    Recommended columns
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-0">
                    <div className="flex flex-wrap gap-2">
                      {leftSections.recommended.map((m) => {
                        const selected = draftSet.has(m.key);
                        return (
                          <button
                            key={m.key}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                              selected
                                ? "border-blue-200 bg-blue-50 text-blue-900"
                                : "border-border bg-muted/40 text-muted-foreground",
                            )}
                            onClick={() => toggleMetric(m.key, !selected)}
                          >
                            {selected ? (
                              <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            ) : null}
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              <AccordionItem value="custom_columns" className="border-none">
                <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                  Custom columns
                </AccordionTrigger>
                <AccordionContent className="pb-3 pt-0">
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Daftar ini disamakan dengan Custom columns (formula) di Google Ads UI. Google
                    tidak menyediakan API untuk mengambilnya otomatis — gunakan{" "}
                    <span className="font-medium">Import</span> dan tempel nama kolom dari Google
                    Ads. Nilai angka di tabel belum dihitung (fase berikutnya: rumus).
                  </p>
                  {onImportUiCustomColumns ? (
                    <Button
                      type="button"
                      variant="link"
                      className="mb-3 h-auto px-0 text-sm text-blue-600"
                      onClick={() => setImportOpen(true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Import dari Google Ads
                    </Button>
                  ) : null}
                  {uiCustomColumnsLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat custom columns…</p>
                  ) : leftSections.custom.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum ada custom columns. Klik Import dan tempel daftar dari Google Ads.
                    </p>
                  ) : (
                    <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                      {leftSections.custom.map((col) => {
                        const checked = draftSet.has(col.key);
                        const disabled = !checked && atLimit;
                        return (
                          <label
                            key={col.key}
                            className={cn(
                              "flex min-w-0 cursor-pointer items-start gap-2 text-sm",
                              disabled && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              className="mt-0.5 shrink-0 border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                              onCheckedChange={(v) => toggleMetric(col.key, v === true)}
                            />
                            <MetricCheckboxLabel label={col.label} description={col.description} />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {leftSections.categories.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id} className="border-none">
                  <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                    {cat.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-0">
                    <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                      {cat.metrics.map((m) => {
                        const checked = draftSet.has(m.key);
                        const disabled = !checked && atLimit;
                        return (
                          <label
                            key={m.key}
                            className={cn(
                              "flex min-w-0 cursor-pointer items-start gap-2 text-sm",
                              disabled && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              className="mt-0.5 shrink-0 border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                              onCheckedChange={(v) => toggleMetric(m.key, v === true)}
                            />
                            <MetricCheckboxLabel label={m.label} description={m.description} />
                          </label>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="flex min-h-0 flex-col bg-muted/30">
            <div className="shrink-0 border-b px-4 py-3">
              <h3 className="text-sm font-medium">Your columns</h3>
              <p className="text-xs text-muted-foreground">Drag and drop to reorder</p>
            </div>
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-1">
                {identityColumns.map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    <Lock className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{col.label}</span>
                  </div>
                ))}
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={draftKeys} strategy={verticalListSortingStrategy}>
                  <div className="mt-1 space-y-1">
                    {draftKeys.map((key) => {
                      const m = metricByKey.get(key);
                      if (!m) return null;
                      return (
                        <SortableMetricRow
                          key={key}
                          metricKey={key}
                          label={m.label}
                          description={m.description}
                          onRemove={() => toggleMetric(key, false)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <div className="shrink-0 px-3 pb-2 text-xs text-muted-foreground">
              {draftKeys.length} / {maxMetrics} metrics
              {draftKeys.length > 30 ? (
                <span className="ml-1 text-amber-700">(large selections may load slower)</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSaving || draftKeys.length === 0 || (savePreset && !presetName.trim())}
              onClick={() => void handleApply()}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-blue-600"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={savePreset}
                  onCheckedChange={(v) => setSavePreset(v === true)}
                />
                Save your column set
              </label>
              <Input
                placeholder="Name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                disabled={!savePreset}
                className="h-8 w-40 text-sm"
              />
            </div>
            {columnSets.length > 0 ? (
              <Select onValueChange={loadPreset}>
                <SelectTrigger className="h-8 w-full max-w-xs text-sm sm:w-56">
                  <SelectValue placeholder="Load saved column set" />
                </SelectTrigger>
                <SelectContent>
                  {columnSets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      </DialogContent>

      {onImportUiCustomColumns ? (
        <GoogleAdsImportUiCustomColumnsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          isImporting={isImportingUiCustomColumns}
          onImport={onImportUiCustomColumns}
        />
      ) : null}
    </Dialog>
  );
}
