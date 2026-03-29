import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';

interface Quarter {
  id: string;
  name: string;
  dateRange: string;
  selected: boolean;
}

interface Year {
  id: string;
  name: string;
  dateRange: string;
  selected: boolean;
  expanded: boolean;
  quarters: Quarter[];
}

interface TimePeriodsProps {
  onSelectionChange?: (selection: { years: string[], quarters: string[] }) => void;
  initialSelection?: { years: string[], quarters: string[] };
  onClose?: () => void;
  availableTimePeriods?: Year[];
}

// No hardcoded data - only use data from database
const initialTimePeriodsData: Year[] = [];

export const TimePeriods: React.FC<TimePeriodsProps> = ({ 
  onSelectionChange, 
  initialSelection,
  onClose,
  availableTimePeriods
}) => {
  const [timePeriods, setTimePeriods] = useState<Year[]>(availableTimePeriods || []);
  const checkboxRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  // Update timePeriods when availableTimePeriods changes - but preserve selection state
  React.useEffect(() => {
    if (availableTimePeriods && availableTimePeriods.length > 0) {
      setTimePeriods(prevPeriods =>
        availableTimePeriods.map(newYear => {
          const existingYear = prevPeriods.find(p => p.id === newYear.id);
          return {
            ...newYear,
            selected: existingYear?.selected ?? false,
            expanded: existingYear?.expanded ?? false,
            quarters: newYear.quarters.map(newQuarter => {
              const existingQuarter = existingYear?.quarters.find(q => q.id === newQuarter.id);
              return { ...newQuarter, selected: existingQuarter?.selected ?? false };
            }),
          };
        })
      );
    } else {
      setTimePeriods([]);
    }
  }, [availableTimePeriods]);

  // Set indeterminate state for year checkboxes
  React.useEffect(() => {
    timePeriods.forEach(year => {
      const checkbox = checkboxRefs.current[year.id];
      if (checkbox) {
        const someQuartersSelected = year.quarters.some(q => q.selected);
        const allQuartersSelected = year.quarters.every(q => q.selected);
        checkbox.indeterminate = someQuartersSelected && !allQuartersSelected;
      }
    });
  }, [timePeriods]);

  // Update selection when initialSelection changes
  React.useEffect(() => {
    if (initialSelection) {
      setTimePeriods(prevPeriods =>
        prevPeriods.map(year => ({
          ...year,
          selected: initialSelection.years.includes(year.id),
          quarters: year.quarters.map(quarter => ({
            ...quarter,
            selected: initialSelection.quarters.includes(quarter.id)
          }))
        }))
      );
    }
  }, [initialSelection]);

  const handleYearToggle = (yearId: string) => {
    setTimePeriods(prevPeriods =>
      prevPeriods.map(year =>
        year.id === yearId ? { ...year, expanded: !year.expanded } : year
      )
    );
  };

  const handleYearSelect = (yearId: string) => {
    setTimePeriods(prevPeriods => {
      const updatedPeriods = prevPeriods.map(year => {
        if (year.id === yearId) {
          const allQuartersSelected = year.quarters.every(q => q.selected);
          const newSelected = !allQuartersSelected;
          return {
            ...year,
            selected: newSelected,
            quarters: year.quarters.map(quarter => ({ ...quarter, selected: newSelected })),
          };
        }
        return year;
      });
      // Notify parent after this commit (do not call inside updater - causes "setState during render" warning)
      const selectedYears = updatedPeriods.filter(y => y.selected).map(y => y.id);
      const selectedQuarters = updatedPeriods.flatMap(y => y.quarters).filter(q => q.selected).map(q => q.id);
      queueMicrotask(() => {
        onSelectionChange?.({ years: selectedYears, quarters: selectedQuarters });
      });
      return updatedPeriods;
    });
  };

  const handleQuarterSelect = (yearId: string, quarterId: string) => {
    setTimePeriods(prevPeriods => {
      const updatedPeriods = prevPeriods.map(year => {
        if (year.id === yearId) {
          const updatedQuarters = year.quarters.map(quarter =>
            quarter.id === quarterId ? { ...quarter, selected: !quarter.selected } : quarter
          );
          const allQuartersSelected = updatedQuarters.every(q => q.selected);
          return {
            ...year,
            selected: allQuartersSelected,
            quarters: updatedQuarters,
          };
        }
        return year;
      });
      const selectedYears = updatedPeriods.filter(y => y.selected).map(y => y.id);
      const selectedQuarters = updatedPeriods.flatMap(y => y.quarters).filter(q => q.selected).map(q => q.id);
      queueMicrotask(() => {
        onSelectionChange?.({ years: selectedYears, quarters: selectedQuarters });
      });
      return updatedPeriods;
    });
  };

  const handleSelectAll = () => {
    setTimePeriods(prevPeriods => {
      const updatedPeriods = prevPeriods.map(year => ({
        ...year,
        selected: true,
        quarters: year.quarters.map(quarter => ({ ...quarter, selected: true })),
      }));
      const selectedYears = updatedPeriods.map(y => y.id);
      const selectedQuarters = updatedPeriods.flatMap(y => y.quarters).map(q => q.id);
      queueMicrotask(() => {
        onSelectionChange?.({ years: selectedYears, quarters: selectedQuarters });
      });
      return updatedPeriods;
    });
  };

  const handleClear = () => {
    setTimePeriods(prevPeriods => {
      const updatedPeriods = prevPeriods.map(year => ({
        ...year,
        selected: false,
        quarters: year.quarters.map(quarter => ({ ...quarter, selected: false })),
      }));
      queueMicrotask(() => {
        onSelectionChange?.({ years: [], quarters: [] });
      });
      return updatedPeriods;
    });
  };

  return (
    <div className="flex h-[300px] w-[300px] min-w-[300px] max-w-[300px] flex-col rounded-md border border-border bg-card shadow-sm">
       {/* Header */}
       <div className="flex items-center justify-between border-b border-border p-3">
         <h3 className="text-sm font-semibold text-foreground">Select Time Periods</h3>
         <div className="flex items-center space-x-2 text-xs">
           <button
             onClick={handleSelectAll}
             type="button"
             className="font-medium text-primary transition-colors hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
           >
             Select all
           </button>
           <span className="text-muted-foreground">-</span>
           <button
             onClick={handleClear}
             type="button"
             className="font-medium text-primary transition-colors hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
           >
             Clear
           </button>
           {onClose && (
             <>
               <span className="text-muted-foreground">-</span>
               <button
                 onClick={onClose}
                 type="button"
                 className="font-medium text-destructive transition-colors hover:text-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
               >
                 Done
               </button>
             </>
           )}
         </div>
       </div>

      {/* Time Period List - Seamless Vertical Scroll */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {timePeriods.length > 0 ? (
          timePeriods.map(year => (
            <div key={year.id} className="border-b border-border/60 last:border-b-0">
              {/* Year Row */}
              <div className="flex items-center px-3 py-2 transition-colors hover:bg-muted/60">
                <div className="flex items-center space-x-2 flex-1">
                  <div className="relative">
                    <input
                      type="checkbox"
                      ref={el => (checkboxRefs.current[year.id] = el)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border border-input bg-background accent-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      checked={year.selected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleYearSelect(year.id);
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">{year.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="min-w-0 flex-shrink-0 text-left text-xs text-muted-foreground">{year.dateRange}</span>
                  <button 
                    type="button"
                    onClick={() => handleYearToggle(year.id)} 
                    className="flex-shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {year.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>

               {/* Quarters List */}
               {year.expanded && (
                 <div className="bg-surface-subtle py-1 pl-6 pr-3">
                   {year.quarters.map(quarter => (
                     <div key={quarter.id} className="flex items-center py-1.5 transition-colors hover:bg-muted/80">
                       <div className="flex items-center space-x-2 flex-1">
                         <input
                           type="checkbox"
                           className="h-4 w-4 shrink-0 cursor-pointer rounded border border-input bg-background accent-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                           checked={quarter.selected}
                           onChange={(e) => {
                             e.stopPropagation();
                             handleQuarterSelect(year.id, quarter.id);
                           }}
                         />
                         <span className="text-left text-sm text-foreground">{quarter.name} -- ({quarter.dateRange})</span>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-8 px-4">
            <div className="text-center">
              <div className="mb-2 text-muted-foreground">
                <Calendar className="mx-auto h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground">No time periods available</p>
              <p className="mt-1 text-xs text-muted-foreground">Please check your OKR cycles configuration</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimePeriods;
