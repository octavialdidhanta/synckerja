
import { ApplicationsFilters } from './ApplicationsFilters';
import { ApplicationsTable } from './ApplicationsTable';

export const ApplicationsPage = () => {
  return (
    <div className="min-h-full">
      {/* Page Content */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <ApplicationsFilters />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <ApplicationsTable />
        </div>
      </div>
    </div>
  );
};
