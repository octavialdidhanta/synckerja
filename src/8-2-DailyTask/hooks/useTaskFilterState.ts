import { useState, useEffect, useCallback } from 'react';
import { TaskFilters } from './useTaskFilters';

const FILTER_STORAGE_KEY = 'daily-task-filters-v3'; // v3: default department = All Departments (ignore saved department)

const defaultFilters: TaskFilters = {
  search: '',
  status: '',
  priority: '',
  dateFilter: '',
  dateRange: undefined,
  customStartDate: undefined,
  customEndDate: undefined,
  planDateRange: undefined, // Default "All Dates & Plans" so task list is not empty; user can switch to "This Month Plan" etc.
  customPlanMonth: undefined,
  pic: '',
  myTask: 'all', // Default to "All" so users see all org tasks; switch to "My Task" to filter
  department: undefined, // Default "All Departments" so list shows all; user can filter by department if needed
  objectiveLink: 'all', // 'unlinked' = only tasks with no Individual Objective
};

export interface UseTaskFilterStateOptions {
  onStorageError?: (message: string) => void;
}

/**
 * Custom hook untuk mengelola filter state dengan localStorage persistence
 * Menyimpan preferensi filter user antar session
 */
export const useTaskFilterState = (options?: UseTaskFilterStateOptions) => {
  const [filters, setFiltersState] = useState<TaskFilters>(() => {
    // Load from localStorage on initial mount
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate and merge with defaults; always use All Departments as default (ignore saved department)
        return {
          ...defaultFilters,
          ...parsed,
          department: defaultFilters.department, // Always default "All Departments"
          myTask: parsed.myTask === 'all' || parsed.myTask === 'my_task'
            ? parsed.myTask
            : defaultFilters.myTask,
          picLevel: parsed.picLevel === 'all' ? 'task' : (parsed.picLevel || undefined),
          objectiveLink: parsed.objectiveLink === 'all' || parsed.objectiveLink === 'unlinked'
            ? parsed.objectiveLink
            : defaultFilters.objectiveLink,
        };
      }
    } catch (error) {
      console.warn('Failed to load filters from localStorage:', error);
    }
    return defaultFilters;
  });

  // Save to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (error: any) {
      // Handle quota exceeded error
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, attempting to clear old filters');
        try {
          // Try to clear old versions and retry
          const oldKeys = ['daily-task-filters-v0', 'daily-task-filters'];
          oldKeys.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              // Ignore errors when removing old keys
            }
          });
          // Retry saving
          localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
        } catch (retryError) {
          console.warn('Failed to save filters after retry:', retryError);
          options?.onStorageError?.('Filter preferences could not be saved.');
        }
      } else {
        console.warn('Failed to save filters to localStorage:', error);
        options?.onStorageError?.('Filter preferences could not be saved.');
      }
    }
  }, [filters, options?.onStorageError]);

  /**
   * Update filters with type safety
   */
  const setFilters = useCallback(
    (
      newFilters: TaskFilters | ((prev: TaskFilters) => TaskFilters)
    ) => {
      setFiltersState((prev) => {
        const updated =
          typeof newFilters === 'function' ? newFilters(prev) : newFilters;
        return updated;
      });
    },
    []
  );

  /**
   * Reset filters to default
   */
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear filters from localStorage:', error);
    }
  }, []);

  /**
   * Update single filter field
   */
  const updateFilter = useCallback(
    <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [setFilters]
  );

  /**
   * Clear all filters except myTask (preserve user preference)
   */
  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...defaultFilters,
      myTask: prev.myTask, // Preserve myTask preference
    }));
  }, [setFilters]);

  return {
    filters,
    setFilters,
    resetFilters,
    updateFilter,
    clearFilters,
  };
};

