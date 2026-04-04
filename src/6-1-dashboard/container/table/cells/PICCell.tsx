
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Lock, CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface Employee {
  id: string;
  full_name: string;
  job_position_name?: string;
}

interface PICCellProps {
  picId: string | null;
  isPICLocked: boolean;
  employees: Employee[];
  selectedPIC: Employee | undefined;
  onPICChange: (value: string) => void;
  isAutoAssigned?: boolean;
  isSelected?: boolean;
}

export const PICCell: React.FC<PICCellProps> = ({
  picId,
  isPICLocked,
  employees,
  selectedPIC,
  onPICChange,
  isAutoAssigned = false,
  isSelected = false
}) => {
  if (isPICLocked) {
    return (
      <div
        className={cn(
          'flex h-8 items-center gap-2 rounded-[5px] border px-3 text-xs',
          isSelected ? 'border-white bg-transparent' : 'border-primary/20 bg-accent'
        )}
      >
        <Lock className={cn('h-3 w-3', isSelected ? 'text-white' : 'text-primary/70')} />
        <span className={cn('font-medium', isSelected ? 'text-white' : 'text-primary')}>
          {selectedPIC?.full_name || 'Auto-assigned PIC'}
        </span>
      </div>
    );
  }

  const picSelectTrigger = isSelected
    ? 'h-8 rounded-[5px] border border-white bg-transparent text-xs text-white shadow-none ring-offset-0 hover:bg-white/10 focus:ring-2 focus:ring-white/50 focus:ring-offset-0 data-[placeholder]:text-white/75 [&>span]:text-inherit [&_svg]:text-white [&_svg]:opacity-90'
    : 'h-8 rounded-[5px] border border-gray-200 bg-white text-xs';

  return (
    <div className="relative">
      <Select
        value={picId || 'placeholder'}
        onValueChange={(value) => {
          if (value === 'placeholder') return;
          onPICChange(value);
        }}
      >
        <SelectTrigger className={picSelectTrigger}>
          <SelectValue placeholder="Select PIC" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="placeholder" disabled>Select PIC</SelectItem>
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              <div className="flex flex-col">
                <span className="font-medium">{employee.full_name}</span>
                <span className="text-xs text-gray-500">{employee.job_position_name || 'Unknown Position'}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAutoAssigned && selectedPIC && (
        <div className="absolute -top-1 -right-1">
          <CheckCircle className="h-4 w-4 rounded-full bg-white text-primary" />
        </div>
      )}
    </div>
  );
};
