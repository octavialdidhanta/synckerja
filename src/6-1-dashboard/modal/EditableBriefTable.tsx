import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Check, X, MoreVertical, Trash2, Plus, Columns3 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

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
  'sticky top-0 z-10 border-b-2 border-r border-gray-300 bg-gray-100 px-3 py-3 text-left font-semibold text-gray-900 min-w-0 overflow-hidden last:border-r-0';

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
  onSave?: (newTableData: string[][]) => void;
  onChange?: (newTableData: string[][]) => void;
  /** When true, table is always editable (no Edit button), onChange called on every cell change */
  alwaysEditable?: boolean;
  /** When true, no edit/actions column (display-only, e.g. content calendar modal) */
  readOnly?: boolean;
  /** Where to render Edit/Save/Cancel controls when not alwaysEditable/readOnly */
  controlsPlacement?: 'actionsColumn' | 'taggingColumn';
  /** BriefDialog storyboard toolbar: Add column/row, Columns menu, Edit/Save/Cancel above table */
  storyboardToolbar?: boolean;
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
  onEditingChange,
  planId,
  imageColumnIndex = 1,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const persistTable = (newData: string[][]) => {
    const finalColCount = Math.max(...newData.map((r) => r.length), 1);
    const padded = sanitizeStoryboardData(padTable(newData, finalColCount));
    onSave?.(padded);
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
    persistTable([headerRow, ...newBody]);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const handleAddRow = async (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const emptyRow = Array.from({ length: tableColCount }, () => '');
    if (tableColCount > imageColumnIndex) {
      emptyRow[imageColumnIndex] = '';
    }
    await onInsertRowImages?.(rowIdx + 1);
    const newBody = [...body.slice(0, rowIdx + 1), emptyRow, ...body.slice(rowIdx + 1)].map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    persistTable([headerRow, ...newBody]);
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

  const isColumnUnused = (colIdx: number, data: string[][]): boolean => {
    if (colIdx === imageColumnIndex) {
      return Object.values(rowImagesMap).flat().length === 0;
    }
    const body = data.slice(1);
    return body.every((row) => (row[colIdx] ?? '').trim() === '');
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

  const unusedColumnIndices = headerRow
    .map((_, colIdx) => colIdx)
    .filter((colIdx) => isColumnUnused(colIdx, displayData));

  const contentColumnCount = Math.max(headerRow.length - 1, 0);
  const totalVisibleColumns = headerRow.length + (showRowActionsColumn ? 1 : 0);
  const useHorizontalScrollLayout =
    totalVisibleColumns > BRIEF_COLUMN_WIDTH_PX.maxColumnsWithoutScroll;
  const fixedSidesPx =
    BRIEF_COLUMN_WIDTH_PX.timing + (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const sharedContentWidth =
    contentColumnCount > 0
      ? `calc((100% - ${fixedSidesPx}px) / ${contentColumnCount})`
      : undefined;
  const scrollTableWidthPx =
    BRIEF_COLUMN_WIDTH_PX.timing +
    contentColumnCount * BRIEF_COLUMN_WIDTH_PX.content +
    (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const tableLayoutKey = briefTableColumnKey(headerRow);

  const renderStoryboardToolbar = () => {
    if (!storyboardToolbar || alwaysEditable || readOnly || !onSave) return null;

    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleAddColumn}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('briefDialog.storyboard.addColumn', 'Add column')}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void handleAppendRow()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('briefDialog.addRow', 'Add row')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                <Columns3 className="mr-1 h-3.5 w-3.5" />
                {t('briefDialog.storyboard.columns', 'Columns')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('briefDialog.storyboard.removeUnusedColumns', 'Remove unused columns')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {unusedColumnIndices.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {t('briefDialog.storyboard.noUnusedColumns', 'No unused columns')}
                </DropdownMenuItem>
              ) : (
                unusedColumnIndices.map((colIdx) => (
                  <DropdownMenuItem
                    key={colIdx}
                    onClick={() => handleRemoveColumn(colIdx)}
                    className="gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    {headerRow[colIdx] || t('briefDialog.storyboard.columnPlaceholder', 'Column {{n}}', { n: colIdx + 1 })}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={saveEdit}
                disabled={mediaBusy}
                className="h-8 gap-1 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
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
                className="h-8 gap-1 text-xs text-gray-600 hover:bg-gray-100"
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
              className="h-8 gap-1 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('briefDialog.edit', 'Edit')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex min-h-0 flex-col', storyboardToolbar && 'flex-1')}>
      {renderStoryboardToolbar()}
      <div
        ref={scrollContainerRef}
        className={cn(
          'my-1 min-h-0 overflow-x-auto overflow-y-auto rounded-lg border-2 border-gray-300 scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          storyboardToolbar ? 'max-h-[calc(100dvh-16rem)] flex-1' : 'max-h-[min(720px,78vh)]',
          className,
        )}
        style={{ overflowAnchor: 'none' } as React.CSSProperties}
      >
        <table
          key={tableLayoutKey}
          className={cn(
            'table-fixed border-collapse text-sm',
            !useHorizontalScrollLayout && 'w-full',
          )}
          style={
            useHorizontalScrollLayout
              ? { width: scrollTableWidthPx, minWidth: scrollTableWidthPx }
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
                      ? { width: BRIEF_COLUMN_WIDTH_PX.content }
                      : { width: sharedContentWidth }
                }
              />
            ))}
            {showRowActionsColumn ? <col style={{ width: BRIEF_COLUMN_WIDTH_PX.actions }} /> : null}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr>
              {headerRow.map((cell, j) => {
                const shouldRenderControlsInThisHeader =
                  showHeaderControls && controlsPlacement === 'taggingColumn' && j === taggingHeaderIndex;

                return (
                  <th
                    key={j}
                    className={briefTableHeaderClass}
                  >
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
                  {showHeaderControls && controlsPlacement === 'actionsColumn' ? renderHeaderControls() : null}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {bodyRows.map((row, rowIdx) => {
              const displayRow = padRow(row);
              const rowImages = rowImagesMap[rowIdx] ?? [];
              const isRowUploading = uploadingRowIndex === rowIdx;
              const isRowDeleting = rowImages.some((image) => image.id === deletingImageId);
              const isStructureBusy = mediaBusy && uploadingRowIndex === null && deletingImageId === null;
              return (
                <tr
                  key={rowIdx}
                  className="hover:bg-gray-50/80 transition-colors"
                >
                  {displayRow.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={briefTableCellClass}
                    >
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
                            <DropdownMenuItem
                              onClick={() => void handleAddRow(rowIdx)}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              {t('briefDialog.addRow', 'Add row')}
                            </DropdownMenuItem>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
