
import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Info, Wrench } from 'lucide-react';
import { 
  getStatusBadgeColor, 
  getConditionBadgeColor, 
  formatAssetStatus, 
  formatAssetCondition 
} from './AssetStatusUtils';

interface AssetStatusConditionProps {
  status: string;
  condition: string;
}

export const AssetStatusCondition = ({ status, condition }: AssetStatusConditionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <Info className="h-3 w-3 mr-1" />
          Status
        </label>
        <div>
          <Badge className={getStatusBadgeColor(status)} variant="secondary">
            {formatAssetStatus(status)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center text-xs font-medium text-muted-foreground">
          <Wrench className="h-3 w-3 mr-1" />
          Condition
        </label>
        <div>
          <Badge className={getConditionBadgeColor(condition)} variant="secondary">
            {formatAssetCondition(condition)}
          </Badge>
        </div>
      </div>
    </div>
  );
};
