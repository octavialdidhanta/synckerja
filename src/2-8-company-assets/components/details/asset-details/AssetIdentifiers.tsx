
import React from 'react';
import { Tag } from 'lucide-react';

interface AssetIdentifiersProps {
  serialNumber?: string;
  assetTag?: string;
}

export const AssetIdentifiers = ({ serialNumber, assetTag }: AssetIdentifiersProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <Tag className="h-3 w-3 mr-1" />
          Serial Number
        </label>
        <p className="font-mono text-sm text-foreground">{serialNumber || '-'}</p>
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <Tag className="h-3 w-3 mr-1" />
          Asset Tag
        </label>
        <p className="font-mono text-sm text-foreground">{assetTag || '-'}</p>
      </div>
    </div>
  );
};
