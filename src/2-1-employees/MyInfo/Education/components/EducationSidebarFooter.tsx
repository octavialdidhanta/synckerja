import { User, GraduationCap } from 'lucide-react';

interface EducationSidebarFooterProps {
  employeeName: string;
  totalEducation: number;
}

export const EducationSidebarFooter = ({ 
  employeeName, 
  totalEducation 
}: EducationSidebarFooterProps) => {
  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1 truncate">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{employeeName}</span>
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
          <GraduationCap className="h-3 w-3" />
          {totalEducation} record{totalEducation !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

