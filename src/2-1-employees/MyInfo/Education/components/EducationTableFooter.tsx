import { BookOpen, Award } from 'lucide-react';

interface EducationTableFooterProps {
  lastUpdated: string;
  highestDegree?: string;
}

export const EducationTableFooter = ({ 
  lastUpdated, 
  highestDegree 
}: EducationTableFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          Last Updated: {lastUpdated}
        </span>
        {highestDegree && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Award className="h-3 w-3" />
            Highest Degree: {highestDegree}
          </span>
        )}
      </div>
    </div>
  );
};

