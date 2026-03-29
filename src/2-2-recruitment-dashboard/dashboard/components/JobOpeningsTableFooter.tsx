interface JobOpeningsTableFooterProps {
  totalJobs: number;
  activeJobs: number;
  filteredJobs: number;
}

export const JobOpeningsTableFooter = ({
  totalJobs,
  activeJobs,
  filteredJobs
}: JobOpeningsTableFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Active: {activeJobs}</span>
        <span className="text-xs text-gray-400">Total: {filteredJobs}</span>
      </div>
    </div>
  );
};
