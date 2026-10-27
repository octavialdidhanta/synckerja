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
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3" />
          Total Certifications: {totalCertifications}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <BookOpen className="h-3 w-3" />
          Last Updated: {lastUpdated}
        </span>
      </div>
    </div>
  );
};

