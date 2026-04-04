import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Check, X, MoreVertical, Trash2, Plus } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  className?: string;
}

export const EditableBriefTable: React.FC<EditableBriefTableProps> = ({
  tableData,
  onSave,
  onChange,
  alwaysEditable = false,
  readOnly = false,
  controlsPlacement = 'actionsColumn',
  className = '',
}) => {
  const { t } = useAppTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<string[][]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Remove trailing empty columns (e.g. extra pipe in markdown creates empty column after Tagging)
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
    const padToTableCols = (arr: string[]) => {
      const a = [...arr];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    };
    const headerRow = tableData[0] ?? [];
    const newData = [headerRow, ...editData.map(padToTableCols)];
    const finalColCount = Math.max(...newData.map((r) => r.length));
    const padded = newData.map((r) => {
      const a = [...r];
      while (a.length < finalColCount) a.push('');
      return a.slice(0, finalColCount);
    });
    onSave?.(padded);
    setIsEditing(false);
    setEditData([]);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollTop });
    }, 0);
  };

  /** Remove row at body index and persist via onSave */
  const handleDeleteRow = (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const padToTableCols = (arr: string[]) => {
      const a = [...arr];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    };
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const newBody = body.filter((_, i) => i !== rowIdx).map(padToTableCols);
    const newData = [padToTableCols(headerRow), ...newBody];
    const finalColCount = Math.max(...newData.map((r) => r.length));
    const padded = newData.map((r) => {
      const a = [...r];
      while (a.length < finalColCount) a.push('');
      return a.slice(0, finalColCount);
    });
    onSave?.(padded);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  /** Insert empty row below rowIdx and persist via onSave */
  const handleAddRow = (rowIdx: number) => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const padToTableCols = (arr: string[]) => {
      const a = [...arr];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    };
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const emptyRow = Array.from({ length: tableColCount }, () => '');
    const newBody = [...body.slice(0, rowIdx + 1), emptyRow, ...body.slice(rowIdx + 1)].map(padToTableCols);
    const newData = [padToTableCols(headerRow), ...newBody];
    const finalColCount = Math.max(...newData.map((r) => r.length));
    const padded = newData.map((r) => {
      const a = [...r];
      while (a.length < finalColCount) a.push('');
      return a.slice(0, finalColCount);
    });
    onSave?.(padded);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
    if (alwaysEditable && onChange) {
      const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
      const padToTableCols = (arr: string[]) => {
        const a = [...arr];
        while (a.length < tableColCount) a.push('');
        return a.slice(0, tableColCount);
      };
      const newData = tableData.map((r, i) => {
        if (i !== rowIdx + 1) return [...r]; // +1 because rowIdx is body row index
        const newRow = [...r];
        while (newRow.length <= cellIdx) newRow.push('');
        newRow[cellIdx] = value;
        return padToTableCols(newRow);
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
  const renderControls = () => {
    if (alwaysEditable || readOnly) return null;
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

  return (
    <div
      ref={scrollContainerRef}
      className={`my-1 overflow-x-auto overflow-y-auto rounded-lg border-2 border-gray-300 min-h-0 max-h-[min(720px,78vh)] scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ overflowAnchor: 'none' } as React.CSSProperties}
    >
      <table className="min-w-[720px] w-full text-sm">
        <thead className="sticky top-0 z-20 bg-gray-50 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
          <tr>
            {headerRow.map((cell, j) => {
              const shouldRenderControlsInThisHeader =
                controlsPlacement === 'taggingColumn' && j === taggingHeaderIndex;

              return (
                <th
                  key={j}
                  className={cn(
                    'sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-800 whitespace-nowrap border-b-2 border-r-2 border-gray-200 last:border-r-0 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]',
                    j === 0 && 'w-[80px] min-w-[80px] max-w-[80px]'
                  )}
                >
                  {shouldRenderControlsInThisHeader ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{cell}</span>
                      {renderControls()}
                    </div>
                  ) : (
                    cell
                  )}
                </th>
              );
            })}
            {!alwaysEditable && !readOnly && controlsPlacement === 'actionsColumn' && (
              <th className="sticky top-0 z-10 w-[72px] min-w-[72px] max-w-[72px] bg-gray-50 px-2 py-3 border-b-2 border-gray-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] font-semibold text-gray-800 whitespace-nowrap overflow-hidden">
                {renderControls()}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {bodyRows.map((row, rowIdx) => {
            const displayRow = padRow(row);
            return (
              <tr
                key={rowIdx}
                className="divide-x divide-gray-200 hover:bg-gray-50/50 transition-colors"
              >
                {displayRow.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={cn(
                      'px-4 py-3 text-gray-700 align-top border-b border-r border-gray-200 last:border-r-0',
                      cellIdx === 0 && 'w-[80px] min-w-[80px] max-w-[80px]'
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
                {!alwaysEditable && !readOnly && controlsPlacement === 'actionsColumn' && (
                  <td className="px-2 py-3 border-b border-gray-200 w-[72px] min-w-[72px] max-w-[72px] whitespace-nowrap overflow-hidden align-middle">
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
  );
};
