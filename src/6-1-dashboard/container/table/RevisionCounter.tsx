
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface RevisionCounterProps {
  count: number;
  onReset: () => void;
  showResetButton?: boolean;
  isSelected?: boolean;
}

export const RevisionCounter: React.FC<RevisionCounterProps> = ({ count, onReset, showResetButton = true, isSelected = false }) => {
  return (
    <div
      className={cn(
        'flex h-8 items-center justify-center gap-1 rounded-[5px] border px-2',
        isSelected ? 'border-white bg-transparent' : 'border-gray-200 bg-white'
      )}
    >
      <span className={cn('text-xs', isSelected ? 'text-white' : 'text-gray-900')}>{count}</span>
      {showResetButton && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          className={cn(
            'h-4 w-4 p-0',
            isSelected ? 'text-white hover:bg-white/15 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <RefreshCw className={cn('h-3 w-3', isSelected ? 'text-white' : '')} />
        </Button>
      )}
    </div>
  );
};
