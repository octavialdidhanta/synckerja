
import React from 'react';

interface AssetsEmptyStateProps {
  isLoading: boolean;
  hasAssets: boolean;
}

export const AssetsEmptyState = ({ isLoading, hasAssets }: AssetsEmptyStateProps) => {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">Loading assets...</p>
      </div>
    );
  }

  if (!hasAssets) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">No assets found matching your criteria</p>
        <p className="mt-2 text-sm text-muted-foreground/80">Try adjusting your search or filters</p>
      </div>
    );
  }

  return null;
};
