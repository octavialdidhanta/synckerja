import { memo, useMemo, useCallback } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { MoreHorizontal, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';
import { JobOpeningsTableFooter } from './JobOpeningsTableFooter';

interface JobOpeningsTableProps {
  jobOpenings: JobOpening[];
  onRefresh: () => void;
  onEditJob: (job: JobOpening) => void;
  onDeleteJob: (id: string) => void;
  onGenerateLink: (job: JobOpening) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'draft':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'closed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'inactive':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatSalary = (min?: number, max?: number) => {
  if (!min && !max) return 'Not specified';
  if (min && max) return `Rp ${min.toLocaleString()} - Rp ${max.toLocaleString()}`;
  if (min) return `From Rp ${min.toLocaleString()}`;
  if (max) return `Up to Rp ${max.toLocaleString()}`;
  return 'Not specified';
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

// Memoized row component for performance
const JobOpeningRow = memo(({
  job,
  onEditJob,
  onDeleteJob,
  onGenerateLink
}: {
  job: JobOpening;
  onEditJob: (job: JobOpening) => void;
  onDeleteJob: (id: string) => void;
  onGenerateLink: (job: JobOpening) => void;
}) => {
  const handleEdit = useCallback(() => {
    onEditJob(job);
  }, [job, onEditJob]);

  const handleDelete = useCallback(() => {
    onDeleteJob(job.id);
  }, [job.id, onDeleteJob]);

  const handleGenerateLink = useCallback(() => {
    onGenerateLink(job);
  }, [job, onGenerateLink]);

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="px-3 py-2.5 text-sm font-medium text-gray-900">
        {job.job_title || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.departments?.name || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.job_positions?.name || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.job_levels?.name || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.location || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {formatSalary(job.salary_min, job.salary_max)}
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <Badge
          className={`${getStatusColor(job.status || 'draft')} text-xs font-medium border`}
        >
          {job.status || 'draft'}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.creator_profile?.full_name || '-'}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-sm text-gray-600">
        {job.submissions || 0}
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGenerateLink}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Generate Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

JobOpeningRow.displayName = 'JobOpeningRow';

export const JobOpeningsTable = memo(({
  jobOpenings,
  onRefresh,
  onEditJob,
  onDeleteJob,
  onGenerateLink
}: JobOpeningsTableProps) => {
  const tableHeaders = useMemo(() => [
    { key: 'title', label: 'Job Title', width: 'w-[200px]' },
    { key: 'department', label: 'Department', width: 'w-[120px]' },
    { key: 'position', label: 'Position', width: 'w-[120px]' },
    { key: 'level', label: 'Level', width: 'w-[100px]' },
    { key: 'location', label: 'Location', width: 'w-[120px]' },
    { key: 'salary', label: 'Salary Range', width: 'w-[150px]' },
    { key: 'status', label: 'Status', width: 'w-[100px]' },
    { key: 'createdBy', label: 'Created By', width: 'w-[120px]' },
    { key: 'applications', label: 'Applications', width: 'w-[100px]' },
    { key: 'actions', label: 'Actions', width: 'w-[80px]' },
  ], []);

  const renderJobOpeningRows = useMemo(() => {
    return jobOpenings.map((job) => (
      <JobOpeningRow
        key={job.id}
        job={job}
        onEditJob={onEditJob}
        onDeleteJob={onDeleteJob}
        onGenerateLink={onGenerateLink}
      />
    ));
  }, [jobOpenings, onEditJob, onDeleteJob, onGenerateLink]);

  const activeJobs = useMemo(() => {
    return jobOpenings.filter(job => job.status === 'active').length;
  }, [jobOpenings]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-x-auto">
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
            {jobOpenings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">💼</div>
                    <div>No job openings found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderJobOpeningRows
            )}
          </TableBody>
        </table>
      </div>

      {/* Table Footer */}
      <JobOpeningsTableFooter
        totalJobs={jobOpenings.length}
        activeJobs={activeJobs}
        filteredJobs={jobOpenings.length}
      />
    </div>
  );
});

JobOpeningsTable.displayName = 'JobOpeningsTable';
