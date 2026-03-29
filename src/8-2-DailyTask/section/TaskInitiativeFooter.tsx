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
    <div className="border-t border-gray-200 p-3 bg-gray-50 flex-shrink-0">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center">
          <Target className="w-4 h-4 text-indigo-600 mb-1" />
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






