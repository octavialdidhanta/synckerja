import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Plus, User } from 'lucide-react';
import { ModalAddIndividualContribution } from '@/1-home/components/HomeOKRDashboard/modal/ModalAddIndividualContribution';
import { FiturTimePeriod, YearQuarterSelection } from './FiturTimePeriod';
import { useToast } from '@/shared/components/ui/use-toast';

interface SectionIndividualObjectivesProgressOverviewProps {
  enhancedIndividualObjectives: any[];
  calculateOverallProgress: () => number;
  activeObjectives: any[];
  draftObjectives: any[];
  completedObjectives: any[];
  loading?: boolean;
  error?: string | null;
  // Props for modal functionality
  organizationId?: string;
  cycleId?: string;
  cycleIds?: string[];
  departmentId?: string;
  yearQuarterSelection?: YearQuarterSelection;
  onYearQuarterChange?: (selection: YearQuarterSelection) => void;
  availableYears?: number[];
  isLoadingCycles?: boolean;
}

export const IndividualObjectivesProgressCard = ({
  enhancedIndividualObjectives,
  calculateOverallProgress,
  activeObjectives,
  draftObjectives,
  completedObjectives,
  loading = false,
  error = null,
  // Props for modal functionality
  organizationId,
  cycleId,
  cycleIds,
  departmentId,
  yearQuarterSelection,
  onYearQuarterChange,
  availableYears,
  isLoadingCycles = false
}: SectionIndividualObjectivesProgressOverviewProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  const handleOpenAddContribution = () => {
    if (!cycleId) {
      toast({
        title: 'No cycle selected',
        description: 'Please wait for OKR cycles to load or select a time period.',
        variant: 'destructive',
      });
      return;
    }
    setShowCreateModal(true);
  };

  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = currentMonth <= 3 ? 'Q1' : currentMonth <= 6 ? 'Q2' : currentMonth <= 9 ? 'Q3' : 'Q4';
  const defaultYearQuarterSelection: YearQuarterSelection = {
    years: {
      [currentYear]: {
        selected: false,
        quarters: { [currentQuarter]: true }
      }
    }
  };
  
  const currentYearQuarterSelection = yearQuarterSelection || defaultYearQuarterSelection;
  
  const handleYearQuarterChange = (selection: YearQuarterSelection) => {
    if (onYearQuarterChange) onYearQuarterChange(selection);
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };


  // Check if any period is selected (use currentYearQuarterSelection so default works when parent hasn't passed)
  const hasSelectedPeriod = currentYearQuarterSelection &&
    Object.values(currentYearQuarterSelection.years).some(year =>
      year.selected || Object.values(year.quarters).some(Boolean)
    );

  const stats = {
    total: hasSelectedPeriod ? enhancedIndividualObjectives.length : 0,
    active: hasSelectedPeriod ? activeObjectives.length : 0,
    draft: hasSelectedPeriod ? draftObjectives.length : 0,
    completed: hasSelectedPeriod ? completedObjectives.length : 0,
    averageProgress: hasSelectedPeriod ? calculateOverallProgress() : 0
  };

  return (
    <div className="space-y-3 flex-shrink-0">

      {/* Progress Overview Header */}
      <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="mr-2 h-5 w-5 text-okr-individual" />
              <h4 className="text-sm font-semibold text-foreground">
                Individual Objectives - {new Date().getFullYear()}
              </h4>
            </div>
            <div className="flex items-center space-x-3">
              {/* Time Period Selector */}
              <FiturTimePeriod
                value={currentYearQuarterSelection}
                onChange={handleYearQuarterChange}
                availableYears={availableYears}
                className="h-8"
                isLoading={isLoadingCycles}
              />
              
              {/* Add Contribution Button */}
              <button 
                onClick={handleOpenAddContribution}
                className="flex h-8 items-center space-x-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                <span>Add Contribution</span>
              </button>
              
              {/* Chevron Toggle */}
              <button
                onClick={handleToggle}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Progress Bar - Always Visible */}
        <div className="p-3">
          {loading ? (
            <div className="space-y-2 py-2 animate-pulse">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Average Progress</span>
                <span className="h-4 w-8 rounded bg-muted" />
              </div>
              <div className="h-2 w-full rounded-full bg-muted" />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Average Progress</span>
                <span className="text-xs font-semibold text-foreground">{stats.averageProgress}%</span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-okr-individual transition-all duration-500"
                  style={{ width: `${stats.averageProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Collapsible Content */}
        {isExpanded && !loading && !error && (
          <div className="space-y-3 border-t border-border p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-success-muted p-2">
                <div className="text-sm font-bold text-success">{stats.active}</div>
                <div className="text-xs font-medium text-success-foreground">Active</div>
              </div>
              <div className="rounded-md bg-surface-muted p-2">
                <div className="text-sm font-bold text-neutral-status">{stats.draft}</div>
                <div className="text-xs font-medium text-neutral-status">Draft</div>
              </div>
              <div className="rounded-md bg-info-muted p-2">
                <div className="text-sm font-bold text-info">{stats.completed}</div>
                <div className="text-xs font-medium text-info-foreground">Completed</div>
              </div>
            </div>
            
            <div className="rounded-md bg-surface-subtle p-2 text-center">
              <div className="text-sm font-bold text-foreground">{stats.total} Total</div>
              <div className="text-xs text-muted-foreground">Overall Progress: {stats.averageProgress}%</div>
            </div>
          </div>
        )}
      </div>

            {/* Create Individual Contribution Modal */}
            {organizationId && (
              <ModalAddIndividualContribution 
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
                organizationId={organizationId}
                cycleId={cycleId}
                cycleIds={cycleIds}
                departmentId={departmentId}
              />
            )}
    </div>
  );
};
