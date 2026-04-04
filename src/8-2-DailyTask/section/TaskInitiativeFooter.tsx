import React from 'react';
import { Target, Clock, CheckCircle } from 'lucide-react';

interface TaskInitiativeFooterProps {
  totalItems: number;
  unassignedItems: number;
}

export const TaskInitiativeFooter: React.FC<TaskInitiativeFooterProps> = ({
  totalItems,
  unassignedItems
}) => {
  const assignedItems = totalItems - unassignedItems;
  
  return (
    <div className="min-w-0 shrink-0 border-t border-gray-200 bg-gray-50 p-3">
      <div className="grid min-w-0 w-full grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center">
          <Target className="mb-1 h-4 w-4 text-primary" />
          <div className="text-xs font-semibold text-gray-900">{totalItems}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        
        <div className="flex flex-col items-center">
          <Clock className="w-4 h-4 text-amber-600 mb-1" />
          <div className="text-xs font-semibold text-gray-900">{unassignedItems}</div>
          <div className="text-xs text-gray-500">Unassigned</div>
        </div>
        
        <div className="flex flex-col items-center">
          <CheckCircle className="w-4 h-4 text-green-600 mb-1" />
          <div className="text-xs font-semibold text-gray-900">{assignedItems}</div>
          <div className="text-xs text-gray-500">Assigned</div>
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-500 italic">
          Showing items from tasks, steps & sub-steps
        </p>
      </div>
    </div>
  );
};






