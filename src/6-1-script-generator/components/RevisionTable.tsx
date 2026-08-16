import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  SCRIPT_BREAKDOWN_CELL_TD,
  SCRIPT_BREAKDOWN_CELL_TH,
  scriptBreakdownDataColumnsMinWidthRem,
  scriptBreakdownRevisionTableClassName,
} from '../utils/scriptBreakdownTableClasses';

interface RevisionTableProps {
  tableData: string[][];
  tableMarkdown: string;
  startIndex: number;
  endIndex: number;
  onRevisiCell: (params: { rowIndex: number; colIndex: number; value: string }) => void;
  onRevisiRow: (params: { rowIndex: number; rowContent: string }) => void;
  onRevisiSection: (content: string) => void;
  onDeleteRow?: (params: { rowIndex: number }) => void;
  disabled?: boolean;
}

function buildRowMarkdown(header: string[], row: string[]): string {
  const pad = (arr: string[], len: number) => {
    const a = [...arr];
    while (a.length < len) a.push('');
    return a.slice(0, len);
  };
  const colCount = Math.max(header.length, row.length);
  const h = pad(header, colCount);
  const r = pad(row, colCount);
  return `| ${h.join(' | ')} |\n| ${r.join(' | ')} |`;
}

export const RevisionTable: React.FC<RevisionTableProps> = ({
  tableData,
  tableMarkdown,
  onRevisiRow,
  onRevisiSection,
  onDeleteRow,
  disabled = false,
}) => {
  const { t } = useAppTranslation();
  if (!tableData || tableData.length === 0) return null;

  // Remove trailing empty columns (e.g. extra pipe in markdown creates empty column after Tagging)
  const trimEmptyColumns = (rows: string[][]) => {
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
  const trimmedData = trimEmptyColumns(tableData);
  const header = trimmedData[0];
  const body = trimmedData.slice(1);
  const actionLabel = t('scriptGenerator.revisi.action', 'Action');
  const tableMinWidth = `max(100%, ${scriptBreakdownDataColumnsMinWidthRem(header.length) + 2.5}rem)`;

  return (
    <div className="my-4 group relative min-w-0 w-full">
      <div className="scrollbar-hide seamless-scroll w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-gray-200">
        <table
          className={scriptBreakdownRevisionTableClassName()}
          style={{ width: '100%', minWidth: tableMinWidth }}
        >
          <colgroup>
            {header.map((_, ci) => (
              <col
                key={ci}
                style={{
                  width:
                    ci === header.length - 1
                      ? '100%'
                      : ci === 0
                        ? '5.5rem'
                        : ci === 1
                          ? '16rem'
                          : ci === 2
                            ? '15rem'
                            : '11rem',
                }}
              />
            ))}
            <col style={{ width: '2.5rem' }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr className="divide-x divide-gray-200">
              {header.map((cell, ci) => (
                <th key={ci} className={SCRIPT_BREAKDOWN_CELL_TH}>
                  {cell}
                </th>
              ))}
              <th className={cn(SCRIPT_BREAKDOWN_CELL_TH, 'px-0')}>
                <div className="flex items-center justify-center">
                  <span className="sr-only">{actionLabel}</span>
                  {!disabled ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-gray-600"
                          title={t('scriptGenerator.revisi.revisiSection', 'Revisi seluruh tabel')}
                          aria-label={t('scriptGenerator.revisi.revisiSection', 'Revisi seluruh tabel')}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => onRevisiSection(tableMarkdown)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t('scriptGenerator.revisi.revisiSection', 'Revisi seluruh tabel')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {body.map((row, ri) => (
              <tr
                key={ri}
                className="divide-x divide-gray-200 hover:bg-gray-50/50 transition-colors group/row"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className={SCRIPT_BREAKDOWN_CELL_TD}>
                    {cell}
                  </td>
                ))}
                <td
                  className={cn(
                    SCRIPT_BREAKDOWN_CELL_TD,
                    'align-middle px-0 group-hover/row:bg-gray-50',
                  )}
                >
                  {!disabled ? (
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-600"
                            title={actionLabel}
                            aria-label={actionLabel}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              onRevisiRow({
                                rowIndex: ri + 1,
                                rowContent: buildRowMarkdown(header, row),
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                            {t('scriptGenerator.revisi.revisiRowShort', 'Baris')}
                          </DropdownMenuItem>
                          {onDeleteRow ? (
                            <DropdownMenuItem
                              className="gap-2 text-red-600 focus:text-red-600"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    t('scriptGenerator.revisi.deleteRowConfirm', 'Hapus baris ini?'),
                                  )
                                ) {
                                  onDeleteRow({ rowIndex: ri + 1 });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('scriptGenerator.revisi.deleteRow', 'Hapus baris')}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
