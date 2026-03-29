import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Accordion } from '@/shared/components/ui/accordion';
import { Calendar } from 'lucide-react';

interface SectionDraftObjectivesProps {
  draftObjectives: any[];
  expandedObjective: string | undefined;
  setExpandedObjective: (value: string | undefined) => void;
  renderObjectiveCard: (objective: any, status: string, borderClass: string, textClass: string) => React.ReactNode;
}

export const SectionDraftObjectives = ({
  draftObjectives,
  expandedObjective,
  setExpandedObjective,
  renderObjectiveCard
}: SectionDraftObjectivesProps) => {
  if (draftObjectives.length === 0) return null;

  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-r border-border bg-neutral-muted px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Draft Objectives</span>
            <Badge variant="outline" className="border-border bg-neutral-muted text-xs text-neutral-status">
              {draftObjectives.length}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Needs Activation
          </div>
        </div>
      </div>
      
      <div className="border-r border-border p-0">
        <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective}>
          {draftObjectives.map(objective => renderObjectiveCard(objective, 'draft', 'border-l-muted-foreground', 'text-muted-foreground'))}
        </Accordion>
      </div>
    </div>
  );
};
