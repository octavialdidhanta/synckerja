
import React from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface AssetPurchaseInfoProps {
  purchasePrice?: number;
  purchaseDate?: string;
}

export const AssetPurchaseInfo = ({ purchasePrice, purchaseDate }: AssetPurchaseInfoProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <DollarSign className="h-3 w-3 mr-1" />
          Purchase Price
        </label>
        <p className="text-sm font-semibold text-foreground">
          {purchasePrice ? `Rp ${purchasePrice.toLocaleString('id-ID')}` : '-'}
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <Calendar className="h-3 w-3 mr-1" />
          Purchase Date
        </label>
        <p className="text-sm text-foreground">
          {purchaseDate ? format(new Date(purchaseDate), 'dd/MM/yyyy') : '-'}
        </p>
      </div>
    </div>
  );
};
