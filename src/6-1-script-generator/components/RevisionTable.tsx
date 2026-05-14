import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import {
  SCRIPT_BREAKDOWN_CELL_TD,
  SCRIPT_BREAKDOWN_CELL_TH,
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

  return (
    <div className="my-4 group relative min-w-0">
      <div className="scrollbar-hide seamless-scroll w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-gray-200">
        <table className={scriptBreakdownRevisionTableClassName()}>
          <thead className="bg-gray-50">
            <tr className="divide-x divide-gray-200">
              {header.map((cell, ci) => (
                <th key={ci} className={SCRIPT_BREAKDOWN_CELL_TH}>
                  {cell}
                </th>
              ))}
              <th className={cn(SCRIPT_BREAKDOWN_CELL_TH, 'px-1.5 text-center whitespace-nowrap')}>
                {t('scriptGenerator.revisi.action', 'Action')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {body.map((row, ri) => (
              <tr key={ri} className="divide-x divide-gray-200 hover:bg-gray-50/50 transition-colors group/row">
                {row.map((cell, ci) => (
                  <td key={ci} className={SCRIPT_BREAKDOWN_CELL_TD}>
                    {cell}
                  </td>
                ))}
                <td className={cn(SCRIPT_BREAKDOWN_CELL_TD, 'align-middle px-1.5')}>
                  {!disabled && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 h-7 text-xs"
                        onClick={() =>
                          onRevisiRow({
                            rowIndex: ri + 1,
                            rowContent: buildRowMarkdown(header, row),
                          })
                        }
                        title={t('scriptGenerator.revisi.revisiRow', 'Revisi seluruh baris (VO, Visual, Element, Tagging menyesuaikan)')}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {t('scriptGenerator.revisi.revisiRowShort', 'Baris')}
                      </Button>
                      {onDeleteRow && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(t('scriptGenerator.revisi.deleteRowConfirm', 'Hapus baris ini?'))) {
                              onDeleteRow({ rowIndex: ri + 1 });
                            }
                          }}
                          title={t('scriptGenerator.revisi.deleteRow', 'Hapus baris')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 h-8"
        onClick={() => onRevisiSection(tableMarkdown)}
        disabled={disabled}
        title={t('scriptGenerator.revisi.revisiSection', 'Revisi seluruh tabel')}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
};
