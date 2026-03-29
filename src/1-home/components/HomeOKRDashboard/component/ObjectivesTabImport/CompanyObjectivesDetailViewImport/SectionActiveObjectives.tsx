import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Accordion } from '@/shared/components/ui/accordion';
import { TrendingUp } from 'lucide-react';

interface SectionActiveObjectivesProps {
  activeObjectives: any[];
  expandedObjective: string | undefined;
  setExpandedObjective: (value: string | undefined) => void;
  renderObjectiveCard: (objective: any, status: string, borderClass: string, textClass: string) => React.ReactNode;
}

export const SectionActiveObjectives = ({
  activeObjectives,
  expandedObjective,
  setExpandedObjective,
  renderObjectiveCard
}: SectionActiveObjectivesProps) => {
  if (activeObjectives.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="rounded-t-lg border-r border-border bg-success-muted px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Active Objectives</span>
            <Badge variant="outline" className="border-primary/20 bg-success-muted text-xs text-success-foreground">
              {activeObjectives.length}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            In Progress
          </div>
        </div>
      </div>
      
      <div className="rounded-b-lg border-r border-border bg-card p-0">
        <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective}>
          {activeObjectives.map(objective => renderObjectiveCard(objective, 'active', 'border-l-primary', 'text-primary'))}
        </Accordion>
      </div>
    </div>
  );
};
