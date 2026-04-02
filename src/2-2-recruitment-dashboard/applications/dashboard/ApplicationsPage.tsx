
import { ApplicationsFilters } from './ApplicationsFilters';
import { ApplicationsTable } from './ApplicationsTable';

export const ApplicationsPage = () => {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      {/* Page Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* Filters — match /recruitment/interviewees (IntervieweeTab) */}
        <div className="rounded-md border bg-white p-2">
          <ApplicationsFilters />
        </div>

        {/* Table — match interviewees table shell */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-white">
          <ApplicationsTable />
        </div>
      </div>
    </div>
  );
};
