import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Accordion } from '@/shared/components/ui/accordion';
import { CheckCircle } from 'lucide-react';

interface SectionCompletedObjectivesProps {
  completedObjectives: any[];
  expandedObjective: string | undefined;
  setExpandedObjective: (value: string | undefined) => void;
  renderObjectiveCard: (objective: any, status: string, borderClass: string, textClass: string) => React.ReactNode;
}

export const SectionCompletedObjectives = ({
  completedObjectives,
  expandedObjective,
  setExpandedObjective,
  renderObjectiveCard
}: SectionCompletedObjectivesProps) => {
  if (completedObjectives.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="bg-blue-50 px-4 py-2 border-b border-r border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-900 text-xs">Completed Objectives</span>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              {completedObjectives.length}
            </Badge>
          </div>
          <div className="text-xs text-gray-500">
            Achieved
          </div>
        </div>
      </div>
      
      <div className="p-0 border-r border-gray-200">
        <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective}>
          {completedObjectives.map(objective => renderObjectiveCard(objective, 'completed', 'border-l-blue-500', 'text-blue-600'))}
        </Accordion>
      </div>
    </div>
  );
};
