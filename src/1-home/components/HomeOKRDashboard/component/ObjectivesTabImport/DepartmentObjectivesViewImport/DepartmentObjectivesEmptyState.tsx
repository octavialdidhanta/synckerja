import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Building2, Target, Plus } from 'lucide-react';

interface DepartmentObjectivesEmptyStateProps {
  departmentName: string;
  onCreateObjective: () => void;
  onAddContribution: () => void;
}

export const DepartmentObjectivesEmptyState: React.FC<DepartmentObjectivesEmptyStateProps> = ({
  departmentName,
  onCreateObjective,
  onAddContribution
}) => {
  return (
    <Card className="border-2 border-dashed border-border bg-surface-subtle">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-foreground">
          No objectives for {departmentName}
        </h3>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          Start building department objectives by creating a new one or contributing to company objectives.
        </p>
        <div className="flex space-x-3">
          <Button
            onClick={onCreateObjective}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Objective
          </Button>
          <Button
            onClick={onAddContribution}
            size="sm"
            variant="destructive"
          >
            <Target className="h-4 w-4 mr-2" />
            Add Contribution
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
