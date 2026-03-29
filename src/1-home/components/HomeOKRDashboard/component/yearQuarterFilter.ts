import type { YearQuarterSelection } from './FiturTimePeriod';
import type { OkrCycle } from '@/types/okr';
import { logger } from '@/shared/lib/logger';

/**
 * Filter OKR cycles based on year-quarter selection
 */
// Global logging state for debouncing
let lastLogTime = 0;
let logCount = 0;
const LOG_DEBOUNCE_MS = 5000; // Only log every 5 seconds max
const MAX_LOGS_PER_SESSION = 3; // Maximum 3 logs per session

// Cache for expensive computations
const computationCache = new Map<string, string[]>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
let cacheTimestamp = 0;

// Memoized computation for better performance
const memoizedFilter = (cycles: OkrCycle[], selection: YearQuarterSelection): string[] => {
  const cacheKey = JSON.stringify({ 
    cycles: cycles.map(c => ({ id: c.id, year: c.year, quarter: c.quarter })), 
    selection 
  });
  
  // Check cache first
  if (computationCache.has(cacheKey) && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return computationCache.get(cacheKey)!;
  }
  
  const result = computeFilter(cycles, selection);
  
  // Update cache
  computationCache.set(cacheKey, result);
  cacheTimestamp = Date.now();
  
  return result;
};

const computeFilter = (cycles: OkrCycle[], selection: YearQuarterSelection): string[] => {
  const selectedCycleIds: string[] = [];

  // Super aggressive logging control - only in development and very limited
  const isDevelopment = process.env.NODE_ENV === 'development';
  const now = Date.now();
  const shouldLog = isDevelopment && 
                   cycles.length <= 5 && // Only for small datasets
                   (now - lastLogTime) > LOG_DEBOUNCE_MS && // Debounce
                   logCount < MAX_LOGS_PER_SESSION; // Limit total logs

  if (shouldLog) {
    logger.debug('🔍 YearQuarter Filter:', {
      cycles: cycles.length,
      hasSelection: Object.values(selection.years).some(y => y.selected || Object.values(y.quarters).some(Boolean))
    });
    lastLogTime = now;
    logCount++;
  }

  Object.entries(selection.years).forEach(([year, yearData]) => {
    if (yearData.selected) {
      // Year is fully selected - include all cycles for this year (yearly AND quarterly cycles)
      const yearCycles = cycles.filter(cycle => cycle.year.toString() === year);
      
      yearCycles.forEach(cycle => {
        selectedCycleIds.push(cycle.id);
      });
    } else {
      // Check for individual quarter selections
      const selectedQuarters = Object.entries(yearData.quarters).filter(([_, isSelected]) => isSelected);
      
      if (selectedQuarters.length > 0) {
        selectedQuarters.forEach(([quarter]) => {
          // Improved quarter matching logic
          const quarterNum = quarter.replace('Q', ''); // Extract number from Q1, Q2, etc.
          
          // Find cycle by matching quarter and year with improved logic
          const matchingCycles = cycles.filter(cycle => {
            if (cycle.year.toString() !== year) return false;
            
            // For quarterly cycles, match the quarter
            if (cycle.period_type === 'quarterly') {
              // Try multiple matching strategies
              const matches = (
                cycle.quarter === `q${quarterNum.toLowerCase()}` ||
                cycle.quarter === quarter.toLowerCase() ||
                cycle.quarter === quarterNum ||
                cycle.name?.includes(quarter) ||
                cycle.name?.includes(`Q${quarterNum}`) ||
                cycle.name === `${year} ${quarter}` ||
                cycle.name === `${year}-${quarter}` ||
                cycle.name?.toLowerCase().includes(`q${quarterNum.toLowerCase()}`)
              );
              
              return matches;
            }
            
            // For yearly cycles, we don't match individual quarters
            return false;
          });
          
          matchingCycles.forEach(cycle => {
            if (!selectedCycleIds.includes(cycle.id)) {
              selectedCycleIds.push(cycle.id);
            }
          });
        });
      }
    }
  });

  // Removed final log to reduce console spam
  return selectedCycleIds;
};

// Export the memoized version for better performance
export const filterCyclesByYearQuarter = memoizedFilter;

/**
 * Check if any year or quarter is selected
 */
export const hasYearQuarterSelection = (selection: YearQuarterSelection): boolean => {
  return Object.values(selection.years).some(yearData => 
    yearData.selected || Object.values(yearData.quarters).some(Boolean)
  );
};

/** Aligns with default period in progress cards (current calendar year + current quarter). */
export function getDefaultYearQuarterSelection(): YearQuarterSelection {
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter =
    currentMonth <= 3
      ? "Q1"
      : currentMonth <= 6
        ? "Q2"
        : currentMonth <= 9
          ? "Q3"
          : "Q4";
  return {
    years: {
      [currentYear]: {
        selected: false,
        quarters: { [currentQuarter]: true },
      },
    },
  };
}

/**
 * Get a readable summary of the selection
 */
export const getYearQuarterSummary = (selection: YearQuarterSelection): string => {
  const selectedItems: string[] = [];
  
  Object.entries(selection.years).forEach(([year, yearData]) => {
    if (yearData.selected) {
      selectedItems.push(`${year} (Full Year)`);
    } else {
      const selectedQuarters = Object.entries(yearData.quarters)
        .filter(([_, selected]) => selected)
        .map(([quarter]) => quarter);
      
      if (selectedQuarters.length > 0) {
        selectedItems.push(`${selectedQuarters.join(', ')} ${year}`);
      }
    }
  });

  if (selectedItems.length === 0) return 'No periods selected';
  if (selectedItems.length === 1) return selectedItems[0];
  return `${selectedItems.length} periods selected`;
};
