import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Check, X, MoreVertical, Trash2, Plus, Columns3 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

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

  const trimEmptyColumns = (rows: string[][]): string[][] => {
    if (rows.length === 0) return rows;
    const colCount = Math.max(...rows.map((r) => r.length));
    let lastNonEmptyCol = -1;
    for (let c = 0; c < colCount; c++) {
      const hasContent = rows.some((r) => (r[c] ?? '').trim() !== '');
      if (hasContent) lastNonEmptyCol = c;
    }
    if (lastNonEmptyCol < 0) return rows;
    return rows.map((r) => r.slice(0, lastNonEmptyCol + 1));
  };

  const displayData = trimEmptyColumns(tableData);
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

  const persistTable = (newData: string[][]) => {
    const finalColCount = Math.max(...newData.map((r) => r.length), 1);
    const padded = padTable(newData, finalColCount);
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

  const handleDeleteRow = (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
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

  const handleAddRow = (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const emptyRow = Array.from({ length: tableColCount }, () => '');
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

  const handleAppendRow = () => {
    const body = isEditing ? editData : displayData.slice(1);
    if (body.length === 0) {
      handleAddRow(-1);
      return;
    }
    handleAddRow(body.length - 1);
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
    const body = data.slice(1);
    return body.every((row) => (row[colIdx] ?? '').trim() === '');
  };

  const handleRemoveColumn = (colIdx: number) => {
    const currentColCount = Math.max(...tableData.map((r) => r.length), 1);
    if (currentColCount <= 1) return;
    const newData = tableData.map((row) => row.filter((_, i) => i !== colIdx));
    persistTable(newData);
    if (isEditing) {
      setEditData((prev) => prev.map((row) => row.filter((_, i) => i !== colIdx)));
    }
    toast.success(t('briefDialog.storyboard.columnRemoved', 'Column removed'));
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
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
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            title={t('common.save', 'Save')}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelEdit}
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
        className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        title={t('common.edit', 'Edit')}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    );
  };

  const unusedColumnIndices = headerRow
    .map((_, colIdx) => colIdx)
    .filter((colIdx) => isColumnUnused(colIdx, tableData));

  const renderStoryboardToolbar = () => {
    if (!storyboardToolbar || alwaysEditable || readOnly || !onSave) return null;

    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleAddColumn}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('briefDialog.storyboard.addColumn', 'Add column')}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleAppendRow}>
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
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr>
              {headerRow.map((cell, j) => {
                const shouldRenderControlsInThisHeader =
                  showHeaderControls && controlsPlacement === 'taggingColumn' && j === taggingHeaderIndex;

                return (
                  <th
                    key={j}
                    className={cn(
                      'sticky top-0 z-10 border-b-2 border-r border-gray-300 bg-gray-100 px-4 py-3 text-left font-semibold text-gray-900 whitespace-nowrap last:border-r-0',
                      j === 0 && 'w-[80px] min-w-[80px] max-w-[80px]',
                    )}
                  >
                    {shouldRenderControlsInThisHeader ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{cell}</span>
                        {renderHeaderControls()}
                      </div>
                    ) : (
                      cell
                    )}
                  </th>
                );
              })}
              {showRowActionsColumn && (
                <th className="sticky top-0 z-10 w-[72px] min-w-[72px] max-w-[72px] overflow-hidden whitespace-nowrap border-b-2 border-l border-gray-300 bg-gray-100 px-2 py-3 font-semibold text-gray-900">
                  {showHeaderControls && controlsPlacement === 'actionsColumn' ? renderHeaderControls() : null}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {bodyRows.map((row, rowIdx) => {
              const displayRow = padRow(row);
              return (
                <tr
                  key={rowIdx}
                  className="hover:bg-gray-50/80 transition-colors"
                >
                  {displayRow.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={cn(
                        'border-b border-r border-gray-300 px-4 py-3 text-gray-700 align-top last:border-r-0',
                        cellIdx === 0 && 'w-[80px] min-w-[80px] max-w-[80px]',
                      )}
                    >
                      {(isEditing || alwaysEditable) ? (
                        <AutoResizeTextarea
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, cellIdx, e.target.value)}
                          className="w-full min-h-[60px] text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none overflow-hidden"
                          minRows={2}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{cell}</span>
                      )}
                    </td>
                  ))}
                  {showRowActionsColumn && (
                    <td className="w-[72px] min-w-[72px] max-w-[72px] overflow-hidden whitespace-nowrap border-b border-l border-gray-300 px-2 py-3 align-middle">
                      {onSave && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                              title={t('common.actions', 'Actions')}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleAddRow(rowIdx)}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              {t('briefDialog.addRow', 'Add row')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteRow(rowIdx)}
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
