import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

interface CompanyAssetsOverviewFooterProps {
  lastUpdated?: string | Date;
}

export const CompanyAssetsOverviewFooter: React.FC<CompanyAssetsOverviewFooterProps> = ({
  lastUpdated
}) => {
  const formatDate = (date?: string | Date) => {
    if (!date) return 'Never';
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last Updated
        </span>
        <span>{formatDate(lastUpdated)}</span>
      </div>
    </div>
  );
};

