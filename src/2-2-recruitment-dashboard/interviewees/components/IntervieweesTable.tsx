import { memo, useMemo, useCallback } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { MoreHorizontal, Eye, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { IntervieweeActionsDropdown } from '../IntervieweeActionsDropdown';
import { IntervieweesTableFooter } from './IntervieweesTableFooter';

interface Interviewee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  interview_date?: string;
  status: string;
  department?: string;
  interviewer?: string;
}

interface IntervieweesTableProps {
  interviewees: Interviewee[];
  onRefresh: () => void;
  onViewProfile: (interviewee: Interviewee) => void;
  onEdit: (interviewee: Interviewee) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

const formatTime = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
};

// Memoized row component for performance
const IntervieweeRow = memo(({
  interviewee,
  onViewProfile,
  onEdit,
  onDelete
}: {
  interviewee: Interviewee;
  onViewProfile: (interviewee: Interviewee) => void;
  onEdit: (interviewee: Interviewee) => void;
  onDelete: (id: string) => void;
}) => {
  const handleViewProfile = useCallback(() => {
    onViewProfile(interviewee);
  }, [interviewee, onViewProfile]);

  const handleEdit = useCallback(() => {
    onEdit(interviewee);
  }, [interviewee, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(interviewee.id);
  }, [interviewee.id, onDelete]);

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="px-3 py-2.5 text-sm">
        <div className="space-y-0.5">
          <p className="font-medium text-gray-900">{interviewee.name || '-'}</p>
          {interviewee.email && (
            <p className="text-xs text-gray-500">{interviewee.email}</p>
          )}
          {interviewee.phone && (
            <p className="text-xs text-gray-500">{interviewee.phone}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {interviewee.position || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        <div className="space-y-0.5">
          <p>{formatDate(interviewee.interview_date)}</p>
          <p className="text-xs text-gray-500">{formatTime(interviewee.interview_date)}</p>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <Badge
          className={`${getStatusColor(interviewee.status)} text-xs font-medium border`}
        >
          {interviewee.status || 'scheduled'}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {interviewee.interviewer || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {interviewee.department || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <IntervieweeActionsDropdown
          onViewProfile={handleViewProfile}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </TableCell>
    </TableRow>
  );
});

IntervieweeRow.displayName = 'IntervieweeRow';

export const IntervieweesTable = memo(({
  interviewees,
  onRefresh,
  onViewProfile,
  onEdit,
  onDelete,
  isLoading
}: IntervieweesTableProps) => {
  const tableHeaders = useMemo(() => [
    { key: 'candidate', label: 'Candidate', width: 'w-[200px]' },
    { key: 'position', label: 'Position', width: 'w-[150px]' },
    { key: 'interviewDate', label: 'Interview Date', width: 'w-[150px]' },
    { key: 'status', label: 'Status', width: 'w-[100px]' },
    { key: 'interviewer', label: 'Interviewer', width: 'w-[150px]' },
    { key: 'department', label: 'Department', width: 'w-[120px]' },
    { key: 'actions', label: 'Actions', width: 'w-[80px]' },
  ], []);

  const renderIntervieweeRows = useMemo(() => {
    return interviewees.map((interviewee) => (
      <IntervieweeRow
        key={interviewee.id}
        interviewee={interviewee}
        onViewProfile={onViewProfile}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ));
  }, [interviewees, onViewProfile, onEdit, onDelete]);

  const scheduledCount = useMemo(() => {
    return interviewees.filter(i => i.status === 'scheduled').length;
  }, [interviewees]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead key={header.key} className={`text-xs font-medium text-gray-700 ${header.width} px-3 bg-gray-50 whitespace-nowrap`}>
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-4 w-52 max-w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : interviewees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📅</div>
                    <div>No interviews found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderIntervieweeRows
            )}
          </TableBody>
        </table>
      </div>

      {/* Table Footer */}
      <IntervieweesTableFooter
        totalInterviews={interviewees.length}
        scheduledInterviews={scheduledCount}
        filteredInterviews={interviewees.length}
      />
    </div>
  );
});

IntervieweesTable.displayName = 'IntervieweesTable';
