import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Table2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '@/shared/hooks/use-mobile';
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
  /** Raise above a parent dialog that uses a custom z-index. */
  overlayClassName?: string;
  contentClassName?: string;
}

function syncColumnNames(prev: string[], count: number): string[] {
  const safeCount = Math.max(1, Math.min(count, MAX_BRIEF_STORYBOARD_COLUMNS));
  const next = prev.slice(0, safeCount);
  while (next.length < safeCount) {
    next.push(defaultColumnNameAt(next.length));
  }
  return next;
}

export const CreateBriefTableDialog: React.FC<CreateBriefTableDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
  overlayClassName,
  contentClassName,
}) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
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

  const inputClass = isMobile ? 'h-10 text-sm' : 'h-8 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
        overlayClassName={overlayClassName}
        className={cn(
          isMobile
            ? 'fixed left-0 right-0 top-0 z-50 flex h-dvh max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none modal-above-safe-area'
            : 'flex max-h-[min(85vh,480px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[400px]',
          contentClassName,
        )}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 space-y-0 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 text-left',
            isMobile
              ? 'safe-area-top flex h-12 flex-row items-center justify-between gap-2 px-4 py-0'
              : 'px-4 py-3',
          )}
        >
          <DialogTitle className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold leading-none">
            <Table2 className="h-4 w-4 shrink-0 text-gray-700" />
            {t('briefDialog.storyboard.createCustomTable', 'Create custom table')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(
              'briefDialog.storyboard.createCustomTableDesc',
              'Set columns and initial rows for the brief storyboard.',
            )}
          </DialogDescription>
          {isMobile ? (
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-white/80 hover:text-foreground"
                aria-label={t('briefDialog.cancel', 'Cancel')}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          ) : null}
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
                  className={inputClass}
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
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-3 pt-1">
            <Label className="flex-shrink-0 text-xs font-medium">
              {t('briefDialog.storyboard.columnNames', 'Column names')}
            </Label>
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    className={inputClass}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter
            className={cn(
              'flex-shrink-0 flex-row justify-end gap-2 space-x-0 border-t border-gray-100 bg-gray-50 px-4 py-2.5',
              isMobile && 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            )}
          >
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
