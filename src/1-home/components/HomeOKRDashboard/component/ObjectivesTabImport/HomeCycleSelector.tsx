
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOkrCycles } from '@/hooks/organized/okr';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type { OkrCycle } from '@/types/okr';
import type { OkrFilterState } from '@/types/okr-filter';

interface HomeCycleSelectorProps {
  selectedCycle?: OkrCycle;
  onCycleSelect: (cycle: OkrCycle | undefined) => void;
  filters: OkrFilterState;
  onFiltersChange: (filters: OkrFilterState) => void;
}

export const HomeCycleSelector: React.FC<HomeCycleSelectorProps> = ({
  selectedCycle,
  onCycleSelect,
  filters,
  onFiltersChange
}) => {
  const { organizationId } = useCurrentOrg();
  const { cycles = [] } = useOkrCycles(organizationId);

  const handleCycleChange = (cycleId: string) => {
    if (cycleId === 'all') {
      onCycleSelect(undefined);
    } else {
      const cycle = cycles.find(c => c.id === cycleId);
      onCycleSelect(cycle);
    }
  };

  const currentIndex = selectedCycle ? cycles.findIndex(c => c.id === selectedCycle.id) : -1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onCycleSelect(cycles[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < cycles.length - 1) {
      onCycleSelect(cycles[currentIndex + 1]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentIndex <= 0}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Select value={selectedCycle?.id || 'all'} onValueChange={handleCycleChange}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue className="text-sm">
              {selectedCycle ? selectedCycle.name : 'All Cycles'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm">All Cycles</SelectItem>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id} className="text-sm">
                {cycle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentIndex >= cycles.length - 1}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

