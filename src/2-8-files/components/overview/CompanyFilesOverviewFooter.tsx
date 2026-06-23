import React from 'react';
import { format } from 'date-fns';
import { COMPANY_CARD_FOOTER } from '@/2-8-dashboard/layout/companyModuleLayout';

interface CompanyFilesOverviewFooterProps {
  lastUpdated?: string | Date;
  totalFiles?: number;
}

export const CompanyFilesOverviewFooter: React.FC<CompanyFilesOverviewFooterProps> = ({
  lastUpdated,
  totalFiles = 0,
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
    <div className={COMPANY_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last updated: {formatDate(lastUpdated)}</span>
        <span className="text-xs text-muted-foreground/80">Total: {totalFiles}</span>
      </div>
    </div>
  );
};
