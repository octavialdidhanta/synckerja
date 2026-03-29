interface JobOpeningsSidebarFooterProps {
  totalDepartments: number;
  selectedDepartment?: string;
  totalJobs: number;
}

export const JobOpeningsSidebarFooter = ({
  totalDepartments,
  selectedDepartment,
  totalJobs
}: JobOpeningsSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Departments: {totalDepartments}</span>
        <span className="text-xs text-gray-400">Total: {totalJobs}</span>
      </div>
    </div>
  );
};
