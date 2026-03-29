import { FileText, TrendingUp } from 'lucide-react';

interface DocumentsTableFooterProps {
  currentMonth: string;
  documentCount: number;
}

export const DocumentsTableFooter = ({ 
  currentMonth, 
  documentCount 
}: DocumentsTableFooterProps) => {
  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Period: {currentMonth}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Total Documents: {documentCount}
        </span>
      </div>
    </div>
  );
};

