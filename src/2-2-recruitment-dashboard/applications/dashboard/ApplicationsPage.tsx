import { ApplicationsFilters } from "./ApplicationsFilters";
import { ApplicationsTable } from "./ApplicationsTable";
import { ApplicationsWorkspace } from "../layout/ApplicationsWorkspace";
import { useJobApplications } from "../hooks/useJobApplications";

export const ApplicationsPage = () => {
  const { data: applications = [] } = useJobApplications();

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="mb-2 flex-shrink-0">
        <div className="rounded-md border border-border bg-card p-2">
          <ApplicationsFilters />
        </div>
      </div>

      <ApplicationsWorkspace count={applications.length}>
        <ApplicationsTable />
      </ApplicationsWorkspace>
    </div>
  );
};
