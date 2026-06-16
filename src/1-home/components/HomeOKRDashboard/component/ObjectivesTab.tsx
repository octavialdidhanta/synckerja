import React from 'react';
import { DepartmentObjectivesView } from './ObjectivesTabImport/DepartmentObjectivesView';
import { IndividualObjectivesView } from './ObjectivesTabImport/IndividualObjectivesView';
import { CompanyObjectivesDetailView } from './ObjectivesTabImport/CompanyObjectivesDetailView';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { getDefaultCycleForCurrentPeriod } from './ObjectivesTabImport/okrUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { YearQuarterSelection } from './FiturTimePeriod';
import { filterCyclesByYearQuarter, hasYearQuarterSelection } from './yearQuarterFilter';
import type { OkrFilterState } from '../../types/okr-filter';

interface ObjectivesTabProps {
  type: 'company' | 'department' | 'individual';
  title: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  userRole: string;
  openKeyResults: { [key: number]: boolean };
  onToggleKeyResults: (index: number) => void;
  stats: {
    avgProgress: number;
    totalObjectives: number;
    nextDeadline: string;
  };
  filters?: OkrFilterState;
  onFiltersChange?: (filters: OkrFilterState) => void;
  yearQuarterSelection?: YearQuarterSelection;
  onYearQuarterChange?: (selection: YearQuarterSelection) => void;
  availableYears?: number[];
}

export const ObjectivesTab = ({
  type,
  title,
  yearQuarterSelection = { years: {} },
  onYearQuarterChange = () => {},
}: ObjectivesTabProps) => {
  const { organizationId } = useCurrentOrg();

  const [selectedCycleId, setSelectedCycleId] = React.useState<string>('');

  const { data: okrCycles = [] } = useOkrCycles(organizationId);

  const filteredCycleIds = React.useMemo(() => {
    if (!hasYearQuarterSelection(yearQuarterSelection)) {
      return [];
    }
    return filterCyclesByYearQuarter(okrCycles, yearQuarterSelection);
  }, [okrCycles, yearQuarterSelection]);

  const hasMultipleCycles = filteredCycleIds.length > 0;

  React.useEffect(() => {
    if (okrCycles.length > 0 && !selectedCycleId && filteredCycleIds.length === 0) {
      const defaultCycleId = getDefaultCycleForCurrentPeriod(okrCycles);
      if (defaultCycleId) {
        setSelectedCycleId(defaultCycleId);
      }
    }
  }, [okrCycles, selectedCycleId, filteredCycleIds]);

  if (type === 'company' && organizationId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
        {hasYearQuarterSelection(yearQuarterSelection) ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CompanyObjectivesDetailView
              organizationId={organizationId}
              cycleId={hasMultipleCycles ? undefined : selectedCycleId}
              cycleIds={hasMultipleCycles ? filteredCycleIds : undefined}
              yearQuarterSelection={yearQuarterSelection}
              onYearQuarterChange={onYearQuarterChange}
            />
          </div>
        ) : (
          <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p>Please select a time period to view objectives</p>
          </div>
        )}
      </div>
    );
  }

  if (type === 'department' && organizationId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DepartmentObjectivesView
            organizationId={organizationId}
            cycleId={hasMultipleCycles ? undefined : selectedCycleId || undefined}
            cycleIds={hasMultipleCycles ? filteredCycleIds : undefined}
          />
        </div>
      </div>
    );
  }

  if (type === 'individual' && organizationId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <IndividualObjectivesView
            organizationId={organizationId}
            cycleId={hasMultipleCycles ? undefined : selectedCycleId || undefined}
            cycleIds={hasMultipleCycles ? filteredCycleIds : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {type === 'company' && organizationId && (
        <CompanyObjectivesDetailView organizationId={organizationId} />
      )}
      {type === 'department' && organizationId && (
        <DepartmentObjectivesView organizationId={organizationId} />
      )}
      {type === 'individual' && organizationId && (
        <IndividualObjectivesView organizationId={organizationId} />
      )}
    </div>
  );
};
