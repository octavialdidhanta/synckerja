import React from 'react';
import { Package, DollarSign } from 'lucide-react';

interface CompanyAssetsTableFooterProps {
  totalAssets: number;
  filteredAssets?: number;
  totalValue: number;
}

export const CompanyAssetsTableFooter: React.FC<CompanyAssetsTableFooterProps> = ({
  totalAssets,
  filteredAssets,
  totalValue
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const displayCount = filteredAssets !== undefined && filteredAssets !== totalAssets
    ? filteredAssets
    : totalAssets;

  const isFiltered = filteredAssets !== undefined && filteredAssets !== totalAssets;

  return (
    <div className="mt-4 flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {isFiltered ? (
              <>Showing {displayCount} of {totalAssets} assets</>
            ) : (
              <>Total: {totalAssets} assets</>
            )}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
          <DollarSign className="h-3 w-3" />
          Total Value: {formatCurrency(totalValue)}
        </span>
      </div>
    </div>
  );
};

