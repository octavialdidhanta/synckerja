import { BookOpen, Award } from 'lucide-react';

interface InformalEducationTableFooterProps {
  totalCertifications: number;
  lastUpdated: string;
}

export const InformalEducationTableFooter = ({ 
  totalCertifications, 
  lastUpdated 
}: InformalEducationTableFooterProps) => {
  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3" />
          Total Certifications: {totalCertifications}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          Last Updated: {lastUpdated}
        </span>
      </div>
    </div>
  );
};

