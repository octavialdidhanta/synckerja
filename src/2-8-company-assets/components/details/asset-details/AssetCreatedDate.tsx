
import React from 'react';
import { format } from 'date-fns';

interface AssetCreatedDateProps {
  createdAt: string;
}

export const AssetCreatedDate = ({ createdAt }: AssetCreatedDateProps) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Created</label>
      <p className="text-xs text-muted-foreground">
        {format(new Date(createdAt), 'dd/MM/yyyy HH:mm')}
      </p>
    </div>
  );
};
