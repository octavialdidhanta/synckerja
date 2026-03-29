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
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Join Date: {joinDate}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          Department: {department}
        </span>
      </div>
    </div>
  );
};

