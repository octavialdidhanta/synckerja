import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Plus, Target } from 'lucide-react';
import { AddObjectiveDialog } from '../../AddObjectiveDialog';
import { FiturTimePeriod, YearQuarterSelection } from './FiturTimePeriod';
import { logger } from '@/shared/lib/logger';

interface SectionCompanyObjectivesProgressOverviewProps {
  enhancedCompanyObjectives: any[];
  calculateOverallProgress: () => number;
  activeObjectives: any[];
  draftObjectives: any[];
  completedObjectives: any[];
  loading?: boolean;
  error?: string | null;
  // Stats data
  stats?: {
    avgProgress: number;
    totalObjectives: number;
    nextDeadline: string;
    active?: number;
    draft?: number;
    completed?: number;
  };
  // Props for modal functionality
  organizationId?: string;
  yearQuarterSelection?: YearQuarterSelection;
  onYearQuarterChange?: (selection: YearQuarterSelection) => void;
  availableYears?: number[];
  isLoadingCycles?: boolean;
}

export const CompanyObjectivesProgressCard = ({
  enhancedCompanyObjectives,
  calculateOverallProgress,
  activeObjectives,
  draftObjectives,
  completedObjectives,
  loading = false,
  error = null,
  stats,
  // Props for modal functionality
  organizationId,
  yearQuarterSelection,
  onYearQuarterChange,
  availableYears,
  isLoadingCycles = false
}: SectionCompanyObjectivesProgressOverviewProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
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

  // Check if any period is selected
  const hasSelectedPeriod = currentYearQuarterSelection && 
    Object.values(currentYearQuarterSelection.years).some(year => 
      year.selected || Object.values(year.quarters).some(Boolean)
    );

  // Calculate stats - prefer data from props/arguments, fallback to stats
  const finalStats = (() => {
    // If no period is selected, return zero stats
    if (!hasSelectedPeriod) {
      return {
        total: 0,
        active: 0,
        draft: 0,
        completed: 0,
        averageProgress: 0
      };
    }

    // If we have actual objective arrays with data, use those
    if (enhancedCompanyObjectives.length > 0) {
      return {
        total: enhancedCompanyObjectives.length,
        active: enhancedCompanyObjectives.filter(obj => obj.status === 'active').length,
        draft: enhancedCompanyObjectives.filter(obj => obj.status === 'draft').length,
        completed: enhancedCompanyObjectives.filter(obj => obj.status === 'completed').length,
        averageProgress: calculateOverallProgress()
      };
    }
    
    // If we have specific objective arrays, use those
    if (activeObjectives.length > 0 || draftObjectives.length > 0 || completedObjectives.length > 0) {
      return {
        total: activeObjectives.length + draftObjectives.length + completedObjectives.length,
        active: activeObjectives.length,
        draft: draftObjectives.length,
        completed: completedObjectives.length,
        averageProgress: calculateOverallProgress()
      };
    }
    
    // Fallback to stats from useObjectiveStats
    if (stats) {
      return {
        total: stats.totalObjectives,
        active: stats.active || 0,
        draft: stats.draft || 0,
        completed: stats.completed || 0,
        averageProgress: stats.avgProgress
      };
    }
    
    // Final fallback
    return {
      total: 0,
      active: 0,
      draft: 0,
      completed: 0,
      averageProgress: 0
    };
  })();

  return (
    <div className="space-y-3 flex-shrink-0">

      {/* Progress Overview Header */}
      <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Target className="mr-2 h-5 w-5 text-okr-company" />
              <h4 className="text-sm font-semibold text-foreground">
                Company Objectives - {new Date().getFullYear()}
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
              
              {/* Add Objective Button */}
              <AddObjectiveDialog 
                type="company"
                buttonClassName="h-8 px-3 py-2 text-sm"
                onObjectiveAdded={() => {
                  logger.debug('Company objective created successfully');
                  // Trigger any necessary data refresh here
                }}
              />
              
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
        
        {/* Progress Bar - Always Visible (skeleton when loading to avoid layout flicker) */}
        <div className="p-3">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Average Progress</span>
                <span className="h-4 w-8 rounded bg-muted" />
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 w-0 rounded-full bg-muted-foreground/30" />
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Average Progress</span>
                <span className="text-xs font-semibold text-foreground">{finalStats.averageProgress}%</span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${finalStats.averageProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Collapsible Content */}
        {isExpanded && !error && (
          <div className="space-y-3 border-t border-border p-3">
            {loading ? (
              <div className="grid grid-cols-3 gap-2 text-center animate-pulse">
                <div className="rounded-md bg-muted p-2"><div className="mx-auto h-4 w-6 rounded bg-muted-foreground/20" /><div className="mx-auto mt-1 h-3 w-12 rounded bg-muted-foreground/20" /></div>
                <div className="rounded-md bg-muted p-2"><div className="mx-auto h-4 w-6 rounded bg-muted-foreground/20" /><div className="mx-auto mt-1 h-3 w-12 rounded bg-muted-foreground/20" /></div>
                <div className="rounded-md bg-muted p-2"><div className="mx-auto h-4 w-6 rounded bg-muted-foreground/20" /><div className="mx-auto mt-1 h-3 w-12 rounded bg-muted-foreground/20" /></div>
                <div className="col-span-3 rounded-md bg-surface-subtle p-2 text-center"><div className="mx-auto h-4 w-16 rounded bg-muted-foreground/20" /><div className="mx-auto mt-1 h-3 w-24 rounded bg-muted-foreground/20" /></div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-success-muted p-2">
                    <div className="text-sm font-bold text-success">{finalStats.active}</div>
                    <div className="text-xs font-medium text-success-foreground">Active</div>
                  </div>
                  <div className="rounded-md bg-surface-muted p-2">
                    <div className="text-sm font-bold text-neutral-status">{finalStats.draft}</div>
                    <div className="text-xs font-medium text-neutral-status">Draft</div>
                  </div>
                  <div className="rounded-md bg-info-muted p-2">
                    <div className="text-sm font-bold text-info">{finalStats.completed}</div>
                    <div className="text-xs font-medium text-info-foreground">Completed</div>
                  </div>
                </div>
                <div className="rounded-md bg-surface-subtle p-2 text-center">
                  <div className="text-sm font-bold text-foreground">{finalStats.total} Total</div>
                  <div className="text-xs text-muted-foreground">Overall Progress: {finalStats.averageProgress}%</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
