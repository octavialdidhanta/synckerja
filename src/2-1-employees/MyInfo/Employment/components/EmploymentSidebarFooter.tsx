import { User, Briefcase } from 'lucide-react';

interface EmploymentSidebarFooterProps {
  employeeName: string;
  jobPosition: string;
}

export const EmploymentSidebarFooter = ({ 
  employeeName, 
  jobPosition 
}: EmploymentSidebarFooterProps) => {
  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1 truncate">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{employeeName}</span>
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
          <Briefcase className="h-3 w-3" />
          {jobPosition}
        </span>
      </div>
    </div>
  );
};

