import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { TaskTitleSortDirection } from '@/8-2-DailyTask/utils/taskListSort';

type TaskListTableHeaderProps = {
  /** Desktop summary table: allow sorting by task title. */
  enableTitleSort?: boolean;
  titleSort?: TaskTitleSortDirection | null;
  onTitleSortToggle?: () => void;
  titleSortAriaLabel?: string;
};

export function TaskListTableHeader({
  enableTitleSort = false,
  titleSort = null,
  onTitleSortToggle,
  titleSortAriaLabel = 'Sort by task title',
}: TaskListTableHeaderProps) {
  const TitleSortIcon =
    titleSort === 'asc' ? ArrowUp : titleSort === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
      <TableRow className="hover:bg-transparent">
        <TableHead
          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
        >
          <span className="sr-only">Expand</span>
        </TableHead>
        <TableHead
          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
        >
          <span className="sr-only">Complete</span>
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}
        >
          {enableTitleSort ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(
                '-ml-2 inline-flex h-8 gap-1 px-2 font-medium uppercase tracking-wider text-gray-500 hover:bg-muted/80 hover:text-gray-700',
                titleSort && 'text-gray-800',
              )}
              onClick={onTitleSortToggle}
              aria-sort={
                titleSort === 'asc' ? 'ascending' : titleSort === 'desc' ? 'descending' : 'none'
              }
              aria-label={titleSortAriaLabel}
            >
              Task Title
              <TitleSortIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          ) : (
            'Task Title'
          )}
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}
        >
          Individual Objective
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
        >
          Department
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}
        >
          PIC
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}
        >
          Plan Date
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}
        >
          Due Date
        </TableHead>
        <TableHead
          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}
        >
          Finish Date
        </TableHead>
        <TableHead
          className="px-2 pr-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}
        >
          Blocker
        </TableHead>
        <TableHead
          className="px-2 pr-8 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}
        >
          Priority
        </TableHead>
        <TableHead
          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}
        >
          Status
        </TableHead>
        <TableHead
          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}
        >
          Progress
        </TableHead>
        <TableHead
          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
          style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
        >
          Action
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
