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
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          Last Updated: {lastUpdated}
        </span>
        {highestDegree && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Award className="h-3 w-3" />
            Highest Degree: {highestDegree}
          </span>
        )}
      </div>
    </div>
  );
};

