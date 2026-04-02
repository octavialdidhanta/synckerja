
import React from 'react';
import { formatAssetType } from './AssetStatusUtils';

interface AssetBasicInfoProps {
  name: string;
  type: string;
  brand?: string;
  model?: string;
}

export const AssetBasicInfo = ({ name, type, brand, model }: AssetBasicInfoProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Asset Name</label>
        <p className="text-sm font-semibold text-foreground">{name}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <p className="text-sm capitalize text-foreground">{formatAssetType(type)}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Brand</label>
        <p className="text-sm text-foreground">{brand || '-'}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Model</label>
        <p className="text-sm text-foreground">{model || '-'}</p>
      </div>
    </div>
  );
};
