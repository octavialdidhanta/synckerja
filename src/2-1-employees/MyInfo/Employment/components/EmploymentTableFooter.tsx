import { Calendar, Building2 } from 'lucide-react';

interface EmploymentTableFooterProps {
  joinDate: string;
  department: string;
}

export const EmploymentTableFooter = ({ 
  joinDate, 
  department 
}: EmploymentTableFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Join Date: {joinDate}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Building2 className="h-3 w-3" />
          Department: {department}
        </span>
      </div>
    </div>
  );
};

