import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Check, X, MoreVertical, Trash2, Plus, Columns3 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import { BriefStoryBoardView, useHideOnScrollDown } from './BriefStoryBoardView';
import { BriefSequenceHeader } from './BriefSequenceHeader';
import {
  readBriefLayoutMode,
  writeBriefLayoutMode,
  type BriefLayoutMode,
} from './briefLayoutMode';
import {
  adjustSequencesForDeleteRow,
  adjustSequencesForInsertRow,
  createBriefSequence,
  findSequenceIndexForRow,
  getSequenceRowRanges,
  normalizeBriefSequences,
  parseBriefSequencesFromMarkdown,
  type BriefSequence,
} from './briefSequences';
import {
  adjustSceneMetaForDeleteRow,
  adjustSceneMetaForInsertRow,
  parseBriefSceneMetaFromMarkdown,
  setSceneCharacterIds,
  type BriefSceneMeta,
} from './briefSceneMeta';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { findBriefImageColumnIndex } from './briefStoryboardConstants';

/** Fixed storyboard column widths (px). */
const BRIEF_COLUMN_WIDTH_PX = {
  timing: 80,
  /** Middle columns (Visual, VO, Element Lainnya, …) — fixed when table scrolls horizontally. */
  content: 360,
  actions: 72,
  /** At most this many visible columns (data + actions) before horizontal scroll. */
  maxColumnsWithoutScroll: 6,
} as const;

function isTimingColumn(header: string, colIdx: number): boolean {
  if (colIdx === 0) return true;
  const h = String(header ?? '').trim().toLowerCase();
  return h === 'timing' || h === 'no' || h === '#' || h === 'no.';
}

/** Pad every row to the same column count (header-driven). */
function normalizeBriefTableRows(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  return rows.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) cells.push('');
    return cells.slice(0, colCount);
  });
}

/** Drop only trailing columns that are empty in header and all body rows. */
function trimTrailingEmptyColumns(rows: string[][]): string[][] {
  const normalized = normalizeBriefTableRows(rows);
  if (normalized.length === 0) return normalized;
  let colCount = normalized[0]?.length ?? 0;
  while (colCount > 1) {
    const colIdx = colCount - 1;
    const headerEmpty = (normalized[0]?.[colIdx] ?? '').trim() === '';
    const bodyEmpty = normalized.slice(1).every((row) => (row[colIdx] ?? '').trim() === '');
    if (!headerEmpty && !bodyEmpty) break;
    if (headerEmpty && bodyEmpty) {
      colCount -= 1;
      continue;
    }
    break;
  }
  return normalized.map((row) => row.slice(0, colCount));
}

function briefTableColumnKey(headerRow: string[]): string {
  return headerRow.map((h) => String(h ?? '').trim()).join('\x1f');
}

const briefTableCellClass =
  'border-b border-r border-gray-300 px-3 py-3 text-gray-700 align-top overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 last:border-r-0';

const briefTableHeaderClass =
  'sticky top-0 z-30 border-b-2 border-r border-gray-300 bg-gray-100 px-3 py-3 text-left font-semibold text-gray-900 min-w-0 overflow-hidden last:border-r-0 [box-shadow:0_-2px_0_0_theme(colors.gray.100)]';

/** Auto-resize textarea to fit content height */
function AutoResizeTextarea({
  value,
  onChange,
  className,
  minRows = 2,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minRows * 30, el.scrollHeight)}px`;
  }, [value, minRows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      rows={minRows}
      {...props}
    />
  );
}

interface EditableBriefTableProps {
  tableData: string[][];
  onSave?: (
    newTableData: string[][],
    meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
  ) => void;
  onChange?: (newTableData: string[][]) => void;
  /** When true, table is always editable (no Edit button), onChange called on every cell change */
  alwaysEditable?: boolean;
  /** When true, no edit/actions column (display-only, e.g. content calendar modal) */
  readOnly?: boolean;
  /** Where to render Edit/Save/Cancel controls when not alwaysEditable/readOnly */
  controlsPlacement?: 'actionsColumn' | 'taggingColumn';
  /** BriefDialog storyboard toolbar: Add column/row, Columns menu, Edit/Save/Cancel above table */
  storyboardToolbar?: boolean;
  /** Mobile calendar: ~2 content columns / scene cards visible with horizontal scroll */
  density?: 'desktop' | 'mobile-2col';
  /** Brief markdown used to hydrate Story Board sequences (HTML comment metadata). */
  sequencesSource?: string;
  /** Notified when inline edit mode toggles (e.g. disable dialog footer actions) */
  onEditingChange?: (isEditing: boolean) => void;
  planId?: string;
  imageColumnIndex?: number;
  rowImagesMap?: Record<number, BriefStoryboardImageWithUrl[]>;
  onUploadImages?: (rowIndex: number, files: File[]) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  onInsertRowImages?: (insertAtRowIndex: number) => Promise<unknown>;
  onDeleteRowImages?: (rowIndex: number) => Promise<unknown>;
  mediaBusy?: boolean;
  uploadingRowIndex?: number | null;
  deletingImageId?: string | null;
  className?: string;
}

export const EditableBriefTable: React.FC<EditableBriefTableProps> = ({
  tableData,
  onSave,
  onChange,
  alwaysEditable = false,
  readOnly = false,
  controlsPlacement = 'actionsColumn',
  storyboardToolbar = false,
  density = 'desktop',
  sequencesSource,
  onEditingChange,
  planId,
  imageColumnIndex: imageColumnIndexProp,
  rowImagesMap = {},
  onUploadImages,
  onDeleteImage,
  onInsertRowImages,
  onDeleteRowImages,
  mediaBusy = false,
  uploadingRowIndex = null,
  deletingImageId = null,
  className = '',
}) => {
  const { t } = useAppTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<string[][]>([]);
  const [layoutMode, setLayoutMode] = useState<BriefLayoutMode>(() => readBriefLayoutMode());
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [columnsDrawerOpen, setColumnsDrawerOpen] = useState(false);
  const [columnNameDraft, setColumnNameDraft] = useState('');
  const [sequences, setSequences] = useState<BriefSequence[]>(() =>
    normalizeBriefSequences(
      parseBriefSequencesFromMarkdown(sequencesSource ?? ''),
      Math.max(0, (tableData?.length ?? 1) - 1),
      t('briefDialog.layout.defaultSequence', 'Sequence 1'),
    ),
  );
  const [sceneMeta, setSceneMeta] = useState<BriefSceneMeta[]>(() =>
    parseBriefSceneMetaFromMarkdown(sequencesSource ?? ''),
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sequencesRef = useRef(sequences);
  sequencesRef.current = sequences;
  const sceneMetaRef = useRef(sceneMeta);
  sceneMetaRef.current = sceneMeta;
  /** Avoid clobbering a just-saved sequence split when parent briefText hydrates one tick later. */
  const skipNextSequencesHydrationRef = useRef(false);

  const handleLayoutModeChange = (mode: BriefLayoutMode) => {
    if (isEditing || mode === layoutMode) return;
    setLayoutMode(mode);
    writeBriefLayoutMode(mode);
  };

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    return () => {
      onEditingChange?.(false);
    };
  }, [onEditingChange]);

  const normalizedTableData = normalizeBriefTableRows(tableData);
  const displayData = trimTrailingEmptyColumns(normalizedTableData);
  /**
   * Prefer Visual-by-name so Timing|VO|Visual tables do not treat VO as the paste slot.
   * Without planId (e.g. AI script manual edit), skip image column so all cells stay text.
   */
  const imageColumnIndex = !planId
    ? -1
    : typeof imageColumnIndexProp === 'number'
      ? imageColumnIndexProp
      : findBriefImageColumnIndex(displayData[0] ?? []);
  const bodyRowCount = Math.max(0, displayData.length - 1);
  const defaultSequenceName = t('briefDialog.layout.defaultSequence', 'Sequence 1');

  useEffect(() => {
    if (!storyboardToolbar || isEditing) return;
    if (skipNextSequencesHydrationRef.current) {
      skipNextSequencesHydrationRef.current = false;
      return;
    }
    setSequences(
      normalizeBriefSequences(
        parseBriefSequencesFromMarkdown(sequencesSource ?? ''),
        bodyRowCount,
        defaultSequenceName,
      ),
    );
    setSceneMeta(parseBriefSceneMetaFromMarkdown(sequencesSource ?? ''));
  }, [storyboardToolbar, sequencesSource, bodyRowCount, isEditing, defaultSequenceName]);

  const colCount = Math.max(...displayData.map((r) => r.length), 1);
  const padRow = (row: string[]) => {
    const r = [...row];
    while (r.length < colCount) r.push('');
    return r;
  };

  const padTable = (rows: string[][], targetColCount: number): string[][] => {
    return rows.map((row) => {
      const a = [...row];
      while (a.length < targetColCount) a.push('');
      return a.slice(0, targetColCount);
    });
  };

  const sanitizeStoryboardData = (rows: string[][]): string[][] => {
    return rows.map((row, rowIdx) => row.map((cell, colIdx) => {
      if (rowIdx > 0 && colIdx === imageColumnIndex) return '';
      return cell;
    }));
  };

  const persistTable = (
    newData: string[][],
    nextSequences?: BriefSequence[],
    nextSceneMeta?: BriefSceneMeta[],
  ) => {
    const finalColCount = Math.max(...newData.map((r) => r.length), 1);
    const padded = sanitizeStoryboardData(padTable(newData, finalColCount));
    const nextBodyCount = Math.max(0, padded.length - 1);
    const normalizedSequences = normalizeBriefSequences(
      nextSequences ?? sequencesRef.current,
      nextBodyCount,
      defaultSequenceName,
    );
    const meta = nextSceneMeta ?? sceneMetaRef.current;
    setSequences(normalizedSequences);
    setSceneMeta(meta);
    onSave?.(padded, { sequences: normalizedSequences, sceneMeta: meta });
    return padded;
  };

  const startEdit = () => {
    const bodyRows = displayData.slice(1).map(padRow);
    setEditData(bodyRows);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData([]);
  };

  const saveEdit = () => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = tableData[0] ?? [];
    const newData = [headerRow, ...editData.map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    })];
    persistTable(newData);
    setIsEditing(false);
    setEditData([]);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollTop });
    }, 0);
  };

  const handleDeleteRow = async (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    await onDeleteRowImages?.(rowIdx);
    const newBody = body.filter((_, i) => i !== rowIdx).map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    const nextSequences = adjustSequencesForDeleteRow(sequencesRef.current, rowIdx);
    const nextSceneMeta = adjustSceneMetaForDeleteRow(sceneMetaRef.current, rowIdx);
    persistTable([headerRow, ...newBody], nextSequences, nextSceneMeta);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const handleAddRow = async (rowIdx: number, sequenceId?: string) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const emptyRow = Array.from({ length: tableColCount }, () => '');
    if (tableColCount > imageColumnIndex) {
      emptyRow[imageColumnIndex] = '';
    }
    const insertAt = rowIdx + 1;
    await onInsertRowImages?.(insertAt);
    const newBody = [...body.slice(0, insertAt), emptyRow, ...body.slice(insertAt)].map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    const nextSequences = sequenceId
      ? sequencesRef.current.map((seq) =>
          seq.id === sequenceId ? { ...seq, rowCount: seq.rowCount + 1 } : { ...seq },
        )
      : adjustSequencesForInsertRow(sequencesRef.current, rowIdx);
    const nextSceneMeta = adjustSceneMetaForInsertRow(sceneMetaRef.current, insertAt);
    persistTable([headerRow, ...newBody], nextSequences, nextSceneMeta);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const handleAppendRow = async () => {
    const body = isEditing ? editData : displayData.slice(1);
    if (body.length === 0) {
      await handleAddRow(-1);
      return;
    }
    await handleAddRow(body.length - 1);
  };

  const handleAddColumn = () => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const newHeader = `Column ${tableColCount + 1}`;
    const newData = tableData.map((row, i) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      a.push(i === 0 ? newHeader : '');
      return a;
    });
    persistTable(newData);
    if (isEditing) {
      setEditData((prev) => prev.map((row) => [...row, '']));
    }
  };

  const handleRenameColumn = (colIdx: number, name: string) => {
    const nextName = name.trim();
    const source = normalizeBriefTableRows(
      isEditing ? [displayData[0] ?? [], ...editData] : displayData,
    );
    const currentHeader = (source[0]?.[colIdx] ?? '').trim();
    if (!nextName || nextName === currentHeader) return;
    const tableColCount = Math.max(...source.map((r) => r.length), 1);
    const newData = source.map((row, rowIdx) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      if (rowIdx === 0) a[colIdx] = nextName;
      return a.slice(0, tableColCount);
    });
    persistTable(newData);
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (colIdx === imageColumnIndex) {
      toast.error(t('briefDialog.storyboard.columnRequired', 'This column is required'));
      return;
    }
    const source = normalizeBriefTableRows(isEditing ? [displayData[0] ?? [], ...editData] : displayData);
    const currentColCount = Math.max(...source.map((r) => r.length), 1);
    if (currentColCount <= 1) return;
    const newData = source.map((row) => row.filter((_, i) => i !== colIdx));
    persistTable(newData);
    if (isEditing) {
      setEditData(newData.slice(1));
    }
    toast.success(t('briefDialog.storyboard.columnRemoved', 'Column removed'));
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
    if (cellIdx === imageColumnIndex) return;
    if (alwaysEditable && onChange) {
      const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
      const newData = tableData.map((r, i) => {
        if (i !== rowIdx + 1) return [...r];
        const newRow = [...r];
        while (newRow.length <= cellIdx) newRow.push('');
        newRow[cellIdx] = value;
        const a = [...newRow];
        while (a.length < tableColCount) a.push('');
        return a.slice(0, tableColCount);
      });
      onChange(newData);
      return;
    }
    setEditData((prev) => {
      const next = prev.map((r) => [...r]);
      const row = next[rowIdx];
      if (!row || cellIdx < 0) return prev;
      const newRow = [...row];
      while (newRow.length <= cellIdx) newRow.push('');
      newRow[cellIdx] = value;
      next[rowIdx] = newRow;
      return next;
    });
  };

  if (displayData.length === 0) return null;

  const headerRow = padRow(displayData[0]);
  const bodyRowsSource = alwaysEditable ? tableData.slice(1) : (isEditing ? editData : displayData.slice(1));
  const bodyRows = bodyRowsSource.map(padRow);
  const taggingHeaderIndex = (() => {
    const idx = headerRow.findIndex((h) => String(h ?? '').trim().toLowerCase() === 'tagging');
    return idx >= 0 ? idx : Math.max(0, headerRow.length - 1);
  })();

  const showHeaderControls =
    !storyboardToolbar && !alwaysEditable && !readOnly;
  const showRowActionsColumn = !alwaysEditable && !readOnly;

  const renderHeaderControls = () => {
    if (!showHeaderControls) return null;
    if (isEditing) {
      return (
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={saveEdit}
            disabled={mediaBusy}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            title={t('common.save', 'Save')}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelEdit}
            disabled={mediaBusy}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title={t('common.cancel', 'Cancel')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={startEdit}
        disabled={mediaBusy}
        className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        title={t('common.edit', 'Edit')}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    );
  };

  const contentColumnCount = Math.max(headerRow.length - 1, 0);
  const totalVisibleColumns = headerRow.length + (showRowActionsColumn ? 1 : 0);
  const isMobile2Col = density === 'mobile-2col';
  const useHorizontalScrollLayout =
    isMobile2Col || totalVisibleColumns > BRIEF_COLUMN_WIDTH_PX.maxColumnsWithoutScroll;
  const fixedSidesPx =
    BRIEF_COLUMN_WIDTH_PX.timing + (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const sharedContentWidth =
    contentColumnCount > 0
      ? `calc((100% - ${fixedSidesPx}px) / ${contentColumnCount})`
      : undefined;
  /** ~2 content columns fit in the scroll viewport; remaining columns scroll horizontally. */
  const mobileContentColCss = 'calc((100cqw - 0.5rem) / 2)';
  const scrollTableWidthPx = isMobile2Col
    ? undefined
    : BRIEF_COLUMN_WIDTH_PX.timing +
      contentColumnCount * BRIEF_COLUMN_WIDTH_PX.content +
      (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const scrollTableWidthCss = isMobile2Col
    ? `calc(${BRIEF_COLUMN_WIDTH_PX.timing}px + ${contentColumnCount} * ((100cqw - 0.5rem) / 2)${
        showRowActionsColumn ? ` + ${BRIEF_COLUMN_WIDTH_PX.actions}px` : ''
      })`
    : undefined;
  const tableLayoutKey = briefTableColumnKey(headerRow);

  const renderStoryboardToolbar = () => {
    if (!storyboardToolbar || alwaysEditable || readOnly || !onSave) return null;

    const toolbarBtnClass = cn('h-8 shrink-0 text-xs', isMobile2Col && 'whitespace-nowrap');

    const layoutToggle = (
      <div
        className="flex shrink-0 items-center rounded-md border border-gray-200 bg-gray-50 p-0.5"
        role="group"
        aria-label={t('briefDialog.layout.toggleLabel', 'Layout mode')}
      >
        {([
          ['storyline', t('briefDialog.layout.storyLine', 'Story Line')],
          ['storyboard', t('briefDialog.layout.storyBoard', 'Story Board')],
        ] as const).map(([mode, label]) => (
          <Button
            key={mode}
            type="button"
            variant={layoutMode === mode ? 'default' : 'ghost'}
            size="sm"
            disabled={isEditing}
            className={cn(
              'h-7 px-2.5 text-xs',
              layoutMode === mode
                ? 'shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900',
            )}
            onClick={() => handleLayoutModeChange(mode)}
          >
            {label}
          </Button>
        ))}
      </div>
    );

    const editActions = isEditing ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={saveEdit}
          disabled={mediaBusy}
          className={cn(
            toolbarBtnClass,
            'gap-1 text-green-600 hover:bg-green-50 hover:text-green-700',
          )}
        >
          <Check className="h-4 w-4" />
          {t('common.save', 'Save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancelEdit}
          disabled={mediaBusy}
          className={cn(toolbarBtnClass, 'gap-1 text-gray-600 hover:bg-gray-100')}
        >
          <X className="h-4 w-4" />
          {t('common.cancel', 'Cancel')}
        </Button>
      </>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startEdit}
        disabled={mediaBusy}
        className={cn(toolbarBtnClass, 'gap-1')}
      >
        <Pencil className="h-3.5 w-3.5" />
        {t('briefDialog.edit', 'Edit')}
      </Button>
    );

    return (
      <div
        className={cn(
          'mb-2 flex items-center gap-2',
          isMobile2Col
            ? 'mb-0 border-y border-border bg-background'
            : 'flex-wrap justify-between',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-1',
            isMobile2Col
              ? 'w-full min-w-0 flex-nowrap overflow-x-auto overflow-y-hidden pl-3 pr-4 py-1.5 scrollbar-hide [touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'flex-wrap',
          )}
        >
          {isEditing ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">{layoutToggle}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {t(
                    'briefDialog.layout.switchBlocked',
                    'Save or cancel editing before switching layout',
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            layoutToggle
          )}
          <Button type="button" variant="outline" size="sm" className={toolbarBtnClass} onClick={handleAddColumn}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('briefDialog.storyboard.addColumn', 'Add column')}
          </Button>
          {layoutMode === 'storyline' ? (
            <Button type="button" variant="outline" size="sm" className={toolbarBtnClass} onClick={() => void handleAppendRow()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('briefDialog.addRow', 'Add row')}
            </Button>
          ) : null}
          {(() => {
            const manageColumnsList = (
              <div className="space-y-1.5 py-1">
                {headerRow.map((header, colIdx) => {
                  const label =
                    header ||
                    t('briefDialog.storyboard.columnPlaceholder', 'Column {{n}}', { n: colIdx + 1 });
                  const canDelete = colIdx !== imageColumnIndex && headerRow.length > 1;
                  const isColumnEditing = editingColumnIndex === colIdx;

                  return (
                    <div
                      key={colIdx}
                      className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isColumnEditing ? (
                        <input
                          type="text"
                          value={columnNameDraft}
                          autoFocus
                          onChange={(e) => setColumnNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameColumn(colIdx, columnNameDraft);
                              setEditingColumnIndex(null);
                              setColumnNameDraft('');
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingColumnIndex(null);
                              setColumnNameDraft('');
                            }
                            e.stopPropagation();
                          }}
                          className="h-7 min-w-0 flex-1 rounded border border-blue-300 bg-white px-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          aria-label={t('briefDialog.storyboard.renameColumn', 'Rename column')}
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate px-1.5 text-xs text-gray-800">{label}</span>
                      )}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={t('common.actions', 'Actions')}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {isColumnEditing ? (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-green-700 focus:text-green-700"
                                onClick={() => {
                                  handleRenameColumn(colIdx, columnNameDraft);
                                  setEditingColumnIndex(null);
                                  setColumnNameDraft('');
                                }}
                              >
                                <Check className="h-4 w-4" />
                                {t('common.save', 'Save')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => {
                                  setEditingColumnIndex(null);
                                  setColumnNameDraft('');
                                }}
                              >
                                <X className="h-4 w-4" />
                                {t('common.cancel', 'Cancel')}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => {
                                setEditingColumnIndex(colIdx);
                                setColumnNameDraft(label);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              {t('briefDialog.edit', 'Edit')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            disabled={!canDelete}
                            className="gap-2 text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (!canDelete) return;
                              handleRemoveColumn(colIdx);
                              if (editingColumnIndex === colIdx) {
                                setEditingColumnIndex(null);
                                setColumnNameDraft('');
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('briefDialog.storyboard.removeColumn', 'Remove column')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            );

            const resetColumnEditor = () => {
              setEditingColumnIndex(null);
              setColumnNameDraft('');
            };

            if (isMobile2Col) {
              return (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={toolbarBtnClass}
                    onClick={() => setColumnsDrawerOpen(true)}
                  >
                    <Columns3 className="mr-1 h-3.5 w-3.5" />
                    {t('briefDialog.storyboard.columns', 'Columns')}
                  </Button>
                  <Drawer
                    shouldScaleBackground={false}
                    open={columnsDrawerOpen}
                    onOpenChange={(open) => {
                      setColumnsDrawerOpen(open);
                      if (!open) resetColumnEditor();
                    }}
                  >
                    <DrawerContent
                      className="z-50 max-h-[85vh] px-0 pb-4"
                      overlayClassName="z-50"
                    >
                      <DrawerHeader className="px-4 pb-2 text-left">
                        <DrawerTitle className="text-base">
                          {t('briefDialog.storyboard.manageColumns', 'Manage columns')}
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 pb-2">
                        {manageColumnsList}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              );
            }

            return (
              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) resetColumnEditor();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className={toolbarBtnClass}>
                    <Columns3 className="mr-1 h-3.5 w-3.5" />
                    {t('briefDialog.storyboard.columns', 'Columns')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuLabel className="px-1 text-xs font-normal text-muted-foreground">
                    {t('briefDialog.storyboard.manageColumns', 'Manage columns')}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {manageColumnsList}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
          {isMobile2Col ? editActions : null}
        </div>
        {isMobile2Col ? null : <div className="flex items-center gap-1">{editActions}</div>}
      </div>
    );
  };

  const useStoryBoardLayout = storyboardToolbar && layoutMode === 'storyboard';
  const normalizedSequences = normalizeBriefSequences(
    sequences,
    bodyRows.length,
    defaultSequenceName,
  );
  const sequenceRanges = getSequenceRowRanges(normalizedSequences);
  const canManageSequences = Boolean(storyboardToolbar && showRowActionsColumn && onSave);
  const hideAddSequence = useHideOnScrollDown(
    scrollContainerRef,
    isMobile2Col && canManageSequences && !useStoryBoardLayout,
    normalizedSequences.length,
  );
  const tableColSpan = headerRow.length + (showRowActionsColumn ? 1 : 0);

  const getCurrentTableForPersist = (): string[][] => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const header = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = (isEditing ? editData : displayData.slice(1)).map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    return [header, ...body];
  };

  const persistSequencesOnly = (nextSequences: BriefSequence[]) => {
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    const normalized = normalizeBriefSequences(
      nextSequences,
      bodyCount,
      defaultSequenceName,
    );
    sequencesRef.current = normalized;
    setSequences(normalized);
    if (!isEditing) {
      skipNextSequencesHydrationRef.current = true;
    }
    onSave?.(getCurrentTableForPersist(), {
      sequences: normalized,
      sceneMeta: sceneMetaRef.current,
    });
  };

  const handleSceneCharacterIdsChange = (rowIndex: number, characterIds: string[]) => {
    const nextMeta = setSceneCharacterIds(sceneMetaRef.current, rowIndex, characterIds);
    setSceneMeta(nextMeta);
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    onSave?.(getCurrentTableForPersist(), {
      sequences: normalizeBriefSequences(
        sequencesRef.current,
        bodyCount,
        defaultSequenceName,
      ),
      sceneMeta: nextMeta,
    });
  };

  const nextSequenceLabel = (sequenceCount: number) =>
    t('briefDialog.layout.newSequenceNumber', 'Sequence {{n}}', { n: sequenceCount });

  const handleRenameSequence = (sequenceId: string, name: string) => {
    persistSequencesOnly(
      sequencesRef.current.map((seq) => (seq.id === sequenceId ? { ...seq, name } : seq)),
    );
  };

  const handleAddSequenceBelow = () => {
    persistSequencesOnly([
      ...sequencesRef.current,
      createBriefSequence(nextSequenceLabel(sequencesRef.current.length + 1), 0),
    ]);
  };

  const handleAddSequenceAfterRow = async (rowIndex: number) => {
    const current = sequencesRef.current.map((sequence) => ({ ...sequence }));
    const sequenceIndex = findSequenceIndexForRow(current, rowIndex);
    const ranges = getSequenceRowRanges(current);
    const range = ranges[sequenceIndex];
    if (!range) return;

    const keepCount = rowIndex - range.startRow + 1;
    const moveCount = Math.max(0, current[sequenceIndex].rowCount - keepCount);
    current[sequenceIndex] = {
      ...current[sequenceIndex],
      rowCount: keepCount,
    };

    const label = nextSequenceLabel(current.length + 1);

    if (moveCount > 0) {
      current.splice(sequenceIndex + 1, 0, createBriefSequence(label, moveCount));
      persistSequencesOnly(current);
      return;
    }

    // Selected row is last in its sequence: create a new sequence and add one blank scene into it.
    current.splice(sequenceIndex + 1, 0, createBriefSequence(label, 0));
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    sequencesRef.current = normalizeBriefSequences(current, bodyCount, defaultSequenceName);
    setSequences(sequencesRef.current);
    if (!isEditing) {
      skipNextSequencesHydrationRef.current = true;
    }
    await handleAddRow(rowIndex);
  };

  const handleDeleteSequence = (sequenceId: string) => {
    const current = sequencesRef.current;
    if (current.length <= 1) return;
    const idx = current.findIndex((seq) => seq.id === sequenceId);
    if (idx < 0) return;
    const target = current[idx];
    const next = current.filter((_, i) => i !== idx).map((seq) => ({ ...seq }));
    if (target.rowCount > 0) {
      const mergeIdx = idx > 0 ? idx - 1 : 0;
      next[mergeIdx] = {
        ...next[mergeIdx],
        rowCount: next[mergeIdx].rowCount + target.rowCount,
      };
    }
    persistSequencesOnly(next);
  };

  const handleAddRowInSequence = async (sequenceId: string) => {
    const ranges = getSequenceRowRanges(sequencesRef.current);
    const range = ranges.find((item) => item.sequence.id === sequenceId);
    if (!range) return;
    const insertAfter = range.rowCount === 0 ? range.startRow - 1 : range.endRow - 1;
    await handleAddRow(insertAfter, sequenceId);
  };

  const handleMoveToNextSequence = (rowIndex: number) => {
    const current = sequencesRef.current.map((seq) => ({ ...seq }));
    const ranges = getSequenceRowRanges(current);
    const seqIdx = ranges.findIndex(
      (item) => rowIndex >= item.startRow && rowIndex < item.endRow,
    );
    if (seqIdx < 0 || seqIdx >= current.length - 1) return;
    if (rowIndex !== ranges[seqIdx].endRow - 1) return;
    if (current[seqIdx].rowCount <= 0) return;
    current[seqIdx] = { ...current[seqIdx], rowCount: current[seqIdx].rowCount - 1 };
    current[seqIdx + 1] = { ...current[seqIdx + 1], rowCount: current[seqIdx + 1].rowCount + 1 };
    persistSequencesOnly(current);
  };

  const handleMoveToPreviousSequence = (rowIndex: number) => {
    const current = sequencesRef.current.map((seq) => ({ ...seq }));
    const ranges = getSequenceRowRanges(current);
    const seqIdx = ranges.findIndex(
      (item) => rowIndex >= item.startRow && rowIndex < item.endRow,
    );
    if (seqIdx <= 0) return;
    if (rowIndex !== ranges[seqIdx].startRow) return;
    if (current[seqIdx].rowCount <= 0) return;
    current[seqIdx] = { ...current[seqIdx], rowCount: current[seqIdx].rowCount - 1 };
    current[seqIdx - 1] = { ...current[seqIdx - 1], rowCount: current[seqIdx - 1].rowCount + 1 };
    persistSequencesOnly(current);
  };

  const renderStoryLineBodyRow = (
    rowIdx: number,
    sequenceMeta?: {
      isFirstInSequence: boolean;
      isLastInSequence: boolean;
      seqIndex: number;
    },
  ) => {
    const row = bodyRows[rowIdx];
    if (!row) return null;
    const displayRow = padRow(row);
    const rowImages = rowImagesMap[rowIdx] ?? [];
    const isRowUploading = uploadingRowIndex === rowIdx;
    const isRowDeleting = rowImages.some((image) => image.id === deletingImageId);
    const isStructureBusy = mediaBusy && uploadingRowIndex === null && deletingImageId === null;
    const canMovePrev = Boolean(
      sequenceMeta?.isFirstInSequence &&
        (sequenceMeta.seqIndex ?? 0) > 0 &&
        storyboardToolbar,
    );
    const canMoveNext = Boolean(
      sequenceMeta?.isLastInSequence &&
        sequenceMeta.seqIndex >= 0 &&
        sequenceMeta.seqIndex < sequenceRanges.length - 1 &&
        storyboardToolbar,
    );

    return (
      <tr key={rowIdx} className="hover:bg-gray-50/80 transition-colors">
        {displayRow.map((cell, cellIdx) => (
          <td key={cellIdx} className={briefTableCellClass}>
            {cellIdx === imageColumnIndex ? (
              <BriefStoryboardImageCell
                rowIndex={rowIdx}
                images={rowImages}
                editable={Boolean((isEditing || alwaysEditable) && planId && !readOnly)}
                disabled={!planId || isStructureBusy || isRowUploading || isRowDeleting}
                isUploading={isRowUploading}
                isDeleting={isRowDeleting}
                onUploadFiles={onUploadImages}
                onDeleteImage={onDeleteImage}
              />
            ) : (isEditing || alwaysEditable) ? (
              <AutoResizeTextarea
                value={cell}
                onChange={(e) => updateCell(rowIdx, cellIdx, e.target.value)}
                className="box-border w-full max-w-full min-h-[60px] resize-none overflow-hidden rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [overflow-wrap:anywhere] [word-break:break-word]"
                minRows={2}
              />
            ) : (
              <span className="block whitespace-pre-wrap">{cell}</span>
            )}
          </td>
        ))}
        {showRowActionsColumn && (
          <td
            className={cn(
              briefTableCellClass,
              'overflow-hidden whitespace-nowrap border-l border-gray-300 px-2 align-middle',
            )}
          >
            {onSave && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={mediaBusy}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    title={t('common.actions', 'Actions')}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleAddRow(rowIdx)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('briefDialog.addRow', 'Add row')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddSequenceAfterRow(rowIdx)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t('briefDialog.layout.addSequence', 'Add sequence')}
                  </DropdownMenuItem>
                  {canMovePrev ? (
                    <DropdownMenuItem
                      onClick={() => handleMoveToPreviousSequence(rowIdx)}
                      className="gap-2"
                    >
                      {t('briefDialog.layout.moveToPreviousSequence', 'Move to previous sequence')}
                    </DropdownMenuItem>
                  ) : null}
                  {canMoveNext ? (
                    <DropdownMenuItem
                      onClick={() => handleMoveToNextSequence(rowIdx)}
                      className="gap-2"
                    >
                      {t('briefDialog.layout.moveToNextSequence', 'Move to next sequence')}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => void handleDeleteRow(rowIdx)}
                    className="gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('briefDialog.deleteRow', 'Delete row')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </td>
        )}
      </tr>
    );
  };

  const addSequenceBelowButton = canManageSequences ? (
    <div
      className={cn(
        'z-10 flex border-t border-border bg-background transition-[transform,opacity] duration-200 ease-out',
        isMobile2Col
          ? cn(
              'absolute inset-x-0 bottom-0 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
              hideAddSequence && 'pointer-events-none translate-y-full opacity-0',
            )
          : 'relative shrink-0 px-2 pb-2 pt-2',
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={handleAddSequenceBelow}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('briefDialog.layout.addSequenceBelow', 'Add Sequence below')}
      </Button>
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden',
        storyboardToolbar && 'flex-1',
        className,
      )}
    >
      {renderStoryboardToolbar()}
      <div
        ref={scrollContainerRef}
        className={cn(
          'min-h-0 flex-1 scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isMobile2Col
            ? cn(
                '@container/brief my-0 w-full min-w-0 rounded-none border-x-0 border-y border-border',
                'nested-scroll-touch-chain-xy [-webkit-overflow-scrolling:touch]',
                useStoryBoardLayout
                  ? 'flex min-h-0 flex-col overflow-hidden [overscroll-behavior-y:contain]'
                  : 'overflow-x-auto overflow-y-auto pb-14 [overscroll-behavior:contain]',
              )
            : cn(
                'overflow-x-auto overflow-y-auto nested-scroll-touch-chain my-1 rounded-lg border-2 border-gray-300',
                storyboardToolbar ? 'max-h-[calc(100dvh-16rem)]' : 'max-h-[min(720px,78vh)]',
              ),
          useStoryBoardLayout && !isMobile2Col && 'flex min-h-0 flex-col overflow-hidden',
        )}
        style={{ overflowAnchor: 'none' } as React.CSSProperties}
      >
        {useStoryBoardLayout ? (
          <BriefStoryBoardView
            headers={headerRow}
            bodyRows={bodyRows}
            imageColumnIndex={imageColumnIndex}
            rowImagesMap={rowImagesMap}
            sequences={normalizedSequences}
            sceneMeta={sceneMeta}
            isEditing={isEditing || alwaysEditable}
            showRowActions={Boolean(showRowActionsColumn && onSave)}
            planId={planId}
            density={density}
            mediaBusy={mediaBusy}
            uploadingRowIndex={uploadingRowIndex}
            deletingImageId={deletingImageId}
            onUpdateCell={updateCell}
            onUploadImages={onUploadImages}
            onDeleteImage={onDeleteImage}
            onAddRow={(rowIdx) => void handleAddRow(rowIdx)}
            onAddSequenceAfterRow={handleAddSequenceAfterRow}
            onDeleteRow={(rowIdx) => void handleDeleteRow(rowIdx)}
            onSceneCharacterIdsChange={handleSceneCharacterIdsChange}
            onRenameSequence={handleRenameSequence}
            onAddSequenceBelow={handleAddSequenceBelow}
            onDeleteSequence={handleDeleteSequence}
            onAddRowInSequence={(sequenceId) => void handleAddRowInSequence(sequenceId)}
            onMoveToPreviousSequence={handleMoveToPreviousSequence}
            onMoveToNextSequence={handleMoveToNextSequence}
          />
        ) : (
          <div
            className={cn(
              storyboardToolbar && 'flex flex-col gap-2',
              useHorizontalScrollLayout && 'w-max min-w-full',
            )}
          >
            <table
              key={tableLayoutKey}
              className={cn(
                'table-fixed border-separate border-spacing-0 text-sm',
                !useHorizontalScrollLayout && 'w-full',
              )}
              style={
                useHorizontalScrollLayout
                  ? isMobile2Col
                    ? { width: scrollTableWidthCss, minWidth: scrollTableWidthCss }
                    : { width: scrollTableWidthPx, minWidth: scrollTableWidthPx }
                  : undefined
              }
            >
              <colgroup>
                {headerRow.map((header, j) => (
                  <col
                    key={j}
                    style={
                      isTimingColumn(header, j)
                        ? { width: BRIEF_COLUMN_WIDTH_PX.timing }
                        : useHorizontalScrollLayout
                          ? isMobile2Col
                            ? { width: mobileContentColCss, minWidth: mobileContentColCss }
                            : { width: BRIEF_COLUMN_WIDTH_PX.content }
                          : { width: sharedContentWidth }
                    }
                  />
                ))}
                {showRowActionsColumn ? <col style={{ width: BRIEF_COLUMN_WIDTH_PX.actions }} /> : null}
              </colgroup>
              <thead className="sticky top-0 z-30 bg-gray-100">
                <tr>
                  {headerRow.map((cell, j) => {
                    const shouldRenderControlsInThisHeader =
                      showHeaderControls &&
                      controlsPlacement === 'taggingColumn' &&
                      j === taggingHeaderIndex;

                    return (
                      <th key={j} className={briefTableHeaderClass}>
                        {shouldRenderControlsInThisHeader ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{cell}</span>
                            {renderHeaderControls()}
                          </div>
                        ) : (
                          <span className="block truncate" title={cell}>
                            {cell}
                          </span>
                        )}
                      </th>
                    );
                  })}
                  {showRowActionsColumn && (
                    <th
                      className={cn(
                        briefTableHeaderClass,
                        'overflow-hidden whitespace-nowrap border-l border-gray-300 px-2',
                      )}
                    >
                      {showHeaderControls && controlsPlacement === 'actionsColumn'
                        ? renderHeaderControls()
                        : null}
                    </th>
                  )}
                </tr>
              </thead>
              {storyboardToolbar ? (
                sequenceRanges.map(({ sequence, startRow, endRow }, seqIndex) => {
                  const rowIndexes = Array.from(
                    { length: Math.max(0, endRow - startRow) },
                    (_, i) => startRow + i,
                  );
                  return (
                    <tbody key={sequence.id} className="bg-white">
                      <tr>
                        <td
                          colSpan={tableColSpan}
                          className="border-b border-gray-300 p-0"
                        >
                          <BriefSequenceHeader
                            className="rounded-none border-x-0 border-t-0 border-b border-blue-100"
                            name={sequence.name}
                            canRename={canManageSequences}
                            canDelete={Boolean(canManageSequences && normalizedSequences.length > 1)}
                            onRename={(name) => handleRenameSequence(sequence.id, name)}
                            onDelete={() => handleDeleteSequence(sequence.id)}
                            onAddRow={
                              canManageSequences
                                ? () => void handleAddRowInSequence(sequence.id)
                                : undefined
                            }
                          />
                        </td>
                      </tr>
                      {rowIndexes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={tableColSpan}
                            className="border-b border-gray-200 px-3 py-4 text-xs text-gray-500"
                          >
                            {t(
                              'briefDialog.layout.emptySequence',
                              'No scenes in this sequence yet.',
                            )}
                          </td>
                        </tr>
                      ) : (
                        rowIndexes.map((rowIdx, localIdx) =>
                          renderStoryLineBodyRow(rowIdx, {
                            isFirstInSequence: localIdx === 0,
                            isLastInSequence: localIdx === rowIndexes.length - 1,
                            seqIndex,
                          }),
                        )
                      )}
                    </tbody>
                  );
                })
              ) : (
                <tbody className="bg-white">
                  {bodyRows.map((_, rowIdx) => renderStoryLineBodyRow(rowIdx))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>
      {!useStoryBoardLayout ? addSequenceBelowButton : null}
    </div>
  );
};
