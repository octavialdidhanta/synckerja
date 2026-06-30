import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT,
  DEFAULT_BRIEF_STORYBOARD_ROW_COUNT,
  MAX_BRIEF_STORYBOARD_COLUMNS,
  MAX_BRIEF_STORYBOARD_ROWS,
  buildStoryboardTable,
  defaultColumnNameAt,
} from './briefStoryboardConstants';

interface CreateBriefTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (tableData: string[][]) => void;
}

function syncColumnNames(prev: string[], count: number): string[] {
  const safeCount = Math.max(1, Math.min(count, MAX_BRIEF_STORYBOARD_COLUMNS));
  const next = prev.slice(0, safeCount);
  while (next.length < safeCount) {
    next.push(defaultColumnNameAt(next.length));
  }
  return next;
}

const compactInputClass = 'h-8 text-sm';

export const CreateBriefTableDialog: React.FC<CreateBriefTableDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
}) => {
  const { t } = useAppTranslation();
  const [columnCount, setColumnCount] = useState(DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT);
  const [columnNames, setColumnNames] = useState<string[]>(() =>
    Array.from({ length: DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT }, (_, i) => defaultColumnNameAt(i)),
  );
  const [initialRowCount, setInitialRowCount] = useState(DEFAULT_BRIEF_STORYBOARD_ROW_COUNT);

  useEffect(() => {
    if (!open) return;
    setColumnCount(DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT);
    setColumnNames(
      Array.from({ length: DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT }, (_, i) => defaultColumnNameAt(i)),
    );
    setInitialRowCount(DEFAULT_BRIEF_STORYBOARD_ROW_COUNT);
  }, [open]);

  const handleColumnCountChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const nextCount = Math.max(1, Math.min(parsed, MAX_BRIEF_STORYBOARD_COLUMNS));
    setColumnCount(nextCount);
    setColumnNames((prev) => syncColumnNames(prev, nextCount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNames = columnNames.map((name) => name.trim()).filter(Boolean);
    if (trimmedNames.length === 0) {
      toast.error(
        t('briefDialog.storyboard.columnNamesRequired', 'Enter at least one column name.'),
      );
      return;
    }
    const tableData = buildStoryboardTable(trimmedNames, initialRowCount);
    onCreate(tableData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,480px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[400px]">
        <DialogHeader className="flex-shrink-0 space-y-0.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
          <DialogTitle className="flex items-center gap-1.5 text-base font-semibold leading-tight">
            <Table2 className="h-4 w-4 shrink-0 text-gray-700" />
            {t('briefDialog.storyboard.createCustomTable', 'Create custom table')}
          </DialogTitle>
          <DialogDescription className="text-xs leading-snug text-muted-foreground">
            {t(
              'briefDialog.storyboard.createCustomTableDesc',
              'Set columns and initial rows for the brief storyboard.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 space-y-3 px-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="brief-table-column-count" className="text-xs font-medium">
                  {t('briefDialog.storyboard.numberOfColumns', 'Number of columns')}
                </Label>
                <Input
                  id="brief-table-column-count"
                  type="number"
                  min={1}
                  max={MAX_BRIEF_STORYBOARD_COLUMNS}
                  value={columnCount}
                  onChange={(e) => handleColumnCountChange(e.target.value)}
                  className={compactInputClass}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-table-row-count" className="text-xs font-medium">
                  {t('briefDialog.storyboard.initialRowCount', 'Initial row count')}
                </Label>
                <Input
                  id="brief-table-row-count"
                  type="number"
                  min={1}
                  max={MAX_BRIEF_STORYBOARD_ROWS}
                  value={initialRowCount}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setInitialRowCount(Math.max(1, Math.min(parsed, MAX_BRIEF_STORYBOARD_ROWS)));
                  }}
                  className={compactInputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-3 pt-1">
            <Label className="flex-shrink-0 text-xs font-medium">
              {t('briefDialog.storyboard.columnNames', 'Column names')}
            </Label>
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-[120px] flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-1.5 pr-0.5">
                {columnNames.map((name, index) => (
                  <Input
                    key={index}
                    value={name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setColumnNames((prev) => prev.map((item, i) => (i === index ? value : item)));
                    }}
                    placeholder={t('briefDialog.storyboard.columnPlaceholder', 'Column {{n}}', {
                      n: index + 1,
                    })}
                    maxLength={80}
                    className={compactInputClass}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('briefDialog.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm">
              {t('briefDialog.storyboard.createTable', 'Create table')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
