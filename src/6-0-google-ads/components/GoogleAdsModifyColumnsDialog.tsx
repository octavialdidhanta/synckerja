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
import { GripVertical, Lock, Minus, Pencil, Search, Trash2, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
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
import {
  GOOGLE_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
  GoogleAdsColumnSetOptionLabel,
} from "@/google-ads/components/GoogleAdsColumnSetOptionLabel";
import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";
import {
  GOOGLE_ADS_IDENTITY_COLUMNS,
  GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS,
  isGoogleAdsPinnedMetricKey,
  isOptionalIdentityColumnKey,
  modifyColumnsTitle,
  stripGoogleAdsPinnedMetricKeys,
} from "@/google-ads/metrics/googleAdsIdentityColumns";
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
  onDeleteColumnSet?: (id: string) => Promise<void>;
  onUpdateColumnSet?: (input: {
    id: string;
    name: string;
    metric_keys: string[];
  }) => Promise<{ id: string } | void>;
  isSaving?: boolean;
  isDeletingColumnSet?: boolean;
  isUpdatingColumnSet?: boolean;
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
  onDeleteColumnSet,
  onUpdateColumnSet,
  isSaving,
  isDeletingColumnSet,
  isUpdatingColumnSet,
}: Props) {
  const maxMetrics = catalog?.max_metrics ?? 50;
  const [search, setSearch] = useState("");
  const [draftKeys, setDraftKeys] = useState<string[]>(() => stripGoogleAdsPinnedMetricKeys(selectedKeys));
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeColumnSetId, setActiveColumnSetId] = useState<string | null>(null);
  const [isEditingColumnSet, setIsEditingColumnSet] = useState(false);
  const [editColumnSetName, setEditColumnSetName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const activeColumnSet = useMemo(
    () => columnSets.find((s) => s.id === activeColumnSetId) ?? null,
    [columnSets, activeColumnSetId],
  );
  const activeIsReadOnly = activeColumnSet?.scope === "global";

  useEffect(() => {
    if (
      activeColumnSetId &&
      !columnSets.some((set) => set.id === activeColumnSetId)
    ) {
      setActiveColumnSetId(null);
      setIsEditingColumnSet(false);
      setEditColumnSetName("");
    }
  }, [columnSets, activeColumnSetId]);

  useEffect(() => {
    if (open) {
      setDraftKeys(stripGoogleAdsPinnedMetricKeys(selectedKeys));
      setSavePreset(false);
      setPresetName("");
      setActiveColumnSetId(null);
      setIsEditingColumnSet(false);
      setEditColumnSetName("");
      setDeleteConfirmOpen(false);
      setSearch("");
      setSearchOpen(false);
    }
  }, [open, selectedKeys]);

  const draftSet = useMemo(() => new Set(draftKeys), [draftKeys]);

  /** Locked columns only — never treat Status/Type as locked (even if API catalog is stale). */
  const identityColumns: GoogleAdsIdentityColumn[] = useMemo(() => {
    const lockedKeys = new Set(GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => c.key));
    if (catalog?.identity_columns?.length) {
      const fromApi = catalog.identity_columns.filter((c) => lockedKeys.has(c.key));
      if (fromApi.length > 0) return fromApi;
    }
    return GOOGLE_ADS_IDENTITY_COLUMNS[entity];
  }, [catalog, entity]);

  const optionalIdentityItems = useMemo(
    () =>
      GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity].map((col) => ({
        key: col.key,
        label: col.label,
        description: "",
        entities: [entity] as GoogleAdsMetricEntity[],
        valueKind: "count" as const,
        defaultSelected: false,
        sortable: true,
      })),
    [entity],
  );

  const leftSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (m: MetricCatalogItem) =>
      !q ||
      m.label.toLowerCase().includes(q) ||
      m.key.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q);

    const recommended = (catalog?.recommended.metrics ?? [])
      .filter((m) => !isGoogleAdsPinnedMetricKey(m.key))
      .filter(matches);
    const synckerjaCat = catalog?.categories.find((c) => c.id === "synckerja_metrics");
    const synckerja =
      entity === "campaign"
        ? (synckerjaCat?.metrics ?? []).filter((m) => !isGoogleAdsPinnedMetricKey(m.key)).filter(matches)
        : [];

    const optional = optionalIdentityItems.filter(matches);

    const categories = (catalog?.categories ?? [])
      .filter((cat) => cat.id !== "synckerja_metrics")
      .map((cat) => ({
        ...cat,
        metrics: cat.metrics.filter((m) => !isGoogleAdsPinnedMetricKey(m.key)).filter(matches),
      }))
      .filter((c) => c.metrics.length > 0);

    return { recommended, categories, synckerja, optional };
  }, [catalog, entity, search, optionalIdentityItems]);

  const accordionDefaults = useMemo(() => {
    const ids = ["recommended", "optional_identity"];
    if (entity === "campaign") ids.push("synckerja_metrics");
    for (const c of leftSections.categories) ids.push(c.id);
    return ids;
  }, [entity, leftSections.categories]);

  const metricByKeyWithOptional = useMemo(() => {
    const map = metricMapFromCatalog(catalog, uiCustomColumns);
    for (const item of optionalIdentityItems) {
      map.set(item.key, item);
    }
    return map;
  }, [catalog, uiCustomColumns, optionalIdentityItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleMetric = (key: string, checked: boolean) => {
    if (isGoogleAdsPinnedMetricKey(key)) return;
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
    await onApply(
      stripGoogleAdsPinnedMetricKeys(draftKeys),
      savePreset ? { saveColumnSetName: trimmedName } : undefined,
    );
    onOpenChange(false);
  };

  const loadPreset = (setId: string) => {
    const preset = columnSets.find((s) => s.id === setId);
    if (!preset) return;
    setActiveColumnSetId(setId);
    setDraftKeys(
      stripGoogleAdsPinnedMetricKeys(preset.metric_keys).filter((k) => metricByKeyWithOptional.has(k)),
    );
    setIsEditingColumnSet(false);
    setEditColumnSetName(preset.name);
  };

  const handleStartEditColumnSet = () => {
    if (!activeColumnSet) return;
    setEditColumnSetName(activeColumnSet.name);
    setIsEditingColumnSet(true);
  };

  const handleUpdateColumnSet = async () => {
    if (!activeColumnSetId || !onUpdateColumnSet) return;
    const trimmed = editColumnSetName.trim();
    if (!trimmed) return;
    const result = await onUpdateColumnSet({
      id: activeColumnSetId,
      name: trimmed,
      metric_keys: draftKeys,
    });
    if (result?.id) {
      setActiveColumnSetId(result.id);
    }
    setIsEditingColumnSet(false);
  };

  const handleDeleteColumnSet = async () => {
    if (!activeColumnSetId || !onDeleteColumnSet) return;
    await onDeleteColumnSet(activeColumnSetId);
    setActiveColumnSetId(null);
    setIsEditingColumnSet(false);
    setEditColumnSetName("");
    setDeleteConfirmOpen(false);
  };

  const atLimit = draftKeys.length >= maxMetrics;
  const hasApiMetric = draftKeys.some((k) => !isOptionalIdentityColumnKey(entity, k));

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

              {leftSections.optional.length > 0 ? (
                <AccordionItem value="optional_identity" className="border-none">
                  <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                    Attributes
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-0">
                    <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                      {leftSections.optional.map((m) => {
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
              ) : null}

              {entity === "campaign" ? (
                <AccordionItem value="synckerja_metrics" className="border-none">
                  <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                    Synckerja metrics
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-0">
                    {leftSections.synckerja.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Tidak ada metrik Synckerja.</p>
                    ) : (
                      <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                        {leftSections.synckerja.map((m) => {
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
                    )}
                  </AccordionContent>
                </AccordionItem>
              ) : null}

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
                      const m = metricByKeyWithOptional.get(key);
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

        <div className="shrink-0 border-t bg-background">
          <div className="border-b border-border/60 bg-muted/30 px-6 py-3.5">
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
              <div className="min-w-0 space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Saved column sets
                </Label>
                {columnSets.length > 0 ? (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <Select
                        value={activeColumnSetId ?? undefined}
                        onValueChange={loadPreset}
                      >
                        <SelectTrigger className="h-9 min-w-0 flex-1 border-gray-200 bg-white text-sm shadow-sm">
                          <SelectValue placeholder="Choose a saved set" />
                        </SelectTrigger>
                        <SelectContent>
                          {columnSets.map((s) => (
                            <SelectItem
                              key={s.id}
                              value={s.id}
                              className={GOOGLE_ADS_COLUMN_SET_SELECT_ITEM_CLASS}
                            >
                              <GoogleAdsColumnSetOptionLabel set={s} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none border-r border-gray-200"
                          disabled={!activeColumnSetId || !onUpdateColumnSet || activeIsReadOnly}
                          onClick={handleStartEditColumnSet}
                          aria-label="Edit column set"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={
                            !activeColumnSetId || !onDeleteColumnSet || isDeletingColumnSet
                              || activeIsReadOnly
                          }
                          onClick={() => setDeleteConfirmOpen(true)}
                          aria-label="Delete column set"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {isEditingColumnSet && activeColumnSetId ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2">
                        <Pencil className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                        <Input
                          value={editColumnSetName}
                          onChange={(e) => setEditColumnSetName(e.target.value)}
                          className="h-8 min-w-[10rem] flex-1 border-gray-200 bg-white text-sm"
                          placeholder="Set name"
                          aria-label="Column set name"
                          disabled={activeIsReadOnly}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 bg-blue-600 hover:bg-blue-700"
                          disabled={
                            !editColumnSetName.trim() ||
                            isUpdatingColumnSet ||
                            draftKeys.length === 0
                              || activeIsReadOnly
                          }
                          onClick={() => void handleUpdateColumnSet()}
                        >
                          Save changes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0"
                          onClick={() => setIsEditingColumnSet(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {activeIsReadOnly
                          ? "This is a shared default set and cannot be edited or deleted."
                          : "Load a set to apply its columns, or edit and delete the selected set."}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No saved sets yet. Save your current selection on the right.
                  </p>
                )}
              </div>

              <div className="min-w-0 space-y-2 lg:max-w-md lg:justify-self-end">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Save current selection
                </Label>
                <div
                  className={cn(
                    "rounded-md border bg-white shadow-sm transition-colors",
                    savePreset ? "border-blue-200 ring-1 ring-blue-100" : "border-gray-200",
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={savePreset}
                      onCheckedChange={(v) => setSavePreset(v === true)}
                      className="border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                    />
                    <span className="text-sm font-medium text-gray-900">Save as new column set</span>
                  </label>
                  {savePreset ? (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-0">
                      <Input
                        placeholder="Enter set name"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="h-9 border-gray-200 text-sm"
                        aria-label="New column set name"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 py-3.5">
            <Button
              type="button"
              className="min-w-[5.5rem] bg-blue-600 hover:bg-blue-700"
              disabled={
                isSaving ||
                !hasApiMetric ||
                (savePreset && !presetName.trim())
              }
              onClick={() => void handleApply()}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column set?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeColumnSet
                ? `"${activeColumnSet.name}" will be removed. This cannot be undone.`
                : "This column set will be removed. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingColumnSet}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingColumnSet}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteColumnSet();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
}
