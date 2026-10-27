import { Briefcase, TrendingUp } from 'lucide-react';

interface WorkExperienceTableFooterProps {
  currentMonth: string;
  totalExperience: number;
}

export const WorkExperienceTableFooter = ({ 
  currentMonth, 
  totalExperience 
}: WorkExperienceTableFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Briefcase className="h-3 w-3" />
          Period: {currentMonth}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <TrendingUp className="h-3 w-3" />
          Total Experience: {totalExperience} years
        </span>
      </div>
    </div>
  );
};

