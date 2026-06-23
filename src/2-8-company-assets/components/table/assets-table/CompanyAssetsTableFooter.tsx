import React from 'react';

interface CompanyAssetsTableFooterProps {
  totalAssets: number;
  filteredAssets?: number;
  totalValue: number;
}

export const CompanyAssetsTableFooter: React.FC<CompanyAssetsTableFooterProps> = ({
  totalAssets,
  filteredAssets,
  totalValue,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const displayCount = filteredAssets ?? totalAssets;

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {displayCount} of {totalAssets} assets
        </span>
        <span className="text-xs text-muted-foreground/80">
          Total value: {formatCurrency(totalValue)}
        </span>
      </div>
    </div>
  );
};
