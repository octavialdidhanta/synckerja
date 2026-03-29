import React from 'react';
import { TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';

export function TaskListTableHeader() {
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
          Task Title
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
