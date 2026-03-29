import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { TimePeriods } from '@/shared/components/TimePeriods';

const DEBOUNCE_MS = 400;

export interface YearQuarterSelection {
  years: {
    [year: string]: {
      selected: boolean;
      quarters: {
        [quarter: string]: boolean;
      };
    };
  };
}

interface FiturTimePeriodProps {
  value: YearQuarterSelection;
  onChange: (selection: YearQuarterSelection) => void;
  availableYears?: number[];
  className?: string;
  isLoading?: boolean;
}

const QUARTERS = [
  { key: 'Q1', label: 'Q1', dateRange: 'Jan 1 - Mar 31' },
  { key: 'Q2', label: 'Q2', dateRange: 'Apr 1 - Jun 30' },
  { key: 'Q3', label: 'Q3', dateRange: 'Jul 1 - Sep 30' },
  { key: 'Q4', label: 'Q4', dateRange: 'Oct 1 - Dec 31' },
];

// Helper function to get current quarter
const getCurrentQuarter = () => {
  const month = new Date().getMonth() + 1; // getMonth() returns 0-11
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  return 'Q4';
};

export const FiturTimePeriod: React.FC<FiturTimePeriodProps> = ({
  value,
  onChange,
  availableYears,
  className,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<YearQuarterSelection | null>(null);

  const flushPending = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingSelectionRef.current) {
      onChange(pendingSelectionRef.current);
      pendingSelectionRef.current = null;
    }
  }, [onChange]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  // Only use availableYears from database, no fallback to hardcoded years
  const years = availableYears || [];

  // Initialize with current quarter selection if not provided and data is available
  React.useEffect(() => {
    if (!isInitialized && Object.keys(value.years).length === 0 && years.length > 0) {
      const currentYear = new Date().getFullYear().toString();
      const currentQuarter = getCurrentQuarter();
      
      // Only initialize if current year is available in the data
      if (years.includes(parseInt(currentYear))) {
        const defaultValue: YearQuarterSelection = { 
          years: {
            [currentYear]: {
              selected: false,
              quarters: {
                [currentQuarter]: true
              }
            }
          }
        };
        
        onChange(defaultValue);
      }
      setIsInitialized(true);
    }
  }, [value, onChange, isInitialized, years]);

  const getSelectedSummary = () => {
    // Show loading state if data is not available
    if (isLoading) {
      return '—';
    }
    
    // Show message if no data available
    if (years.length === 0) {
      return 'No data available';
    }
    
    const selectedItems: string[] = [];
    
    if (!value || !value.years) {
      return 'Select Period';
    }
    
    Object.entries(value.years).forEach(([year, yearData]) => {
      if (yearData.selected) {
        selectedItems.push(year);
      } else {
        const selectedQuarters = Object.entries(yearData.quarters)
          .filter(([_, selected]) => selected)
          .map(([quarter]) => quarter);
        
        if (selectedQuarters.length > 0) {
          selectedItems.push(`${selectedQuarters.join(', ')} ${year}`);
        }
      }
    });

    if (selectedItems.length === 0) return 'Select periods';
    if (selectedItems.length === 1) return selectedItems[0];
    return `${selectedItems.length} periods selected`;
  };

  // Convert YearQuarterSelection to TimePeriods format
  const convertToTimePeriodsFormat = () => {
    return years.map(year => {
      const yearStr = year.toString();
      const yearData = value.years[yearStr] || { selected: false, quarters: {} };
      
      return {
        id: yearStr,
        name: yearStr,
        dateRange: 'Jan 1 - Dec 31',
        selected: yearData.selected || false,
        expanded: false, // TimePeriods component will manage its own expanded state
        quarters: QUARTERS.map(quarter => ({
          id: `${quarter.key}-${yearStr}`,
          name: `${quarter.key}-${yearStr}`,
          dateRange: quarter.dateRange,
          selected: yearData.quarters[quarter.key] || false
        }))
      };
    });
  };

  // Handle selection change from TimePeriods – debounce so parent/refetch doesn’t run on every click (avoids “reload” feeling)
  const handleTimePeriodsChange = useCallback((selection: { years: string[], quarters: string[] }) => {
    const newValue: YearQuarterSelection = { years: {} };
    years.forEach(year => {
      const yearStr = year.toString();
      const isYearSelected = selection.years.includes(yearStr);
      newValue.years[yearStr] = {
        selected: isYearSelected,
        quarters: {}
      };
      QUARTERS.forEach(quarter => {
        const quarterId = `${quarter.key}-${yearStr}`;
        newValue.years[yearStr].quarters[quarter.key] = selection.quarters.includes(quarterId);
      });
    });
    pendingSelectionRef.current = newValue;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (pendingSelectionRef.current) {
        onChange(pendingSelectionRef.current);
        pendingSelectionRef.current = null;
      }
    }, DEBOUNCE_MS);
  }, [years, onChange]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) flushPending();
    setIsOpen(open);
  }, [flushPending]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("justify-between", className)}
          disabled={isLoading || years.length === 0}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="truncate">{getSelectedSummary()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      {!isLoading && years.length > 0 && (
        <PopoverContent className="w-auto p-0" align="start">
          <TimePeriods
            availableTimePeriods={convertToTimePeriodsFormat()}
            onSelectionChange={handleTimePeriodsChange}
            onClose={() => setIsOpen(false)}
          />
        </PopoverContent>
      )}
    </Popover>
  );
};

// Utility function to check if there's any selection
export const hasYearQuarterSelection = (selection: YearQuarterSelection): boolean => {
  return Object.values(selection.years).some(yearData => 
    yearData.selected || Object.values(yearData.quarters).some(Boolean)
  );
};
