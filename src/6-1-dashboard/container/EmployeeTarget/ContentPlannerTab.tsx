import React, { useState, useRef, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit, Target } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { ContentManager } from '../../types/social-media';
import type { DigitalMarketingEmployee } from '../../hook/useDigitalMarketingEmployees';
import { useDigitalMarketingEmployees } from '../../hook/useDigitalMarketingEmployees';
import { usePICFilter } from '../../context/PICFilterContext';
import { useOptimizedSocialMedia } from '../../hook/useOptimizedSocialMediaState';
import { useEmployeeTargets } from '../../hook/useEmployeeTargets';
import { ProgressBar } from '@/shared/components/ProgressBar';
import EditTargetDialog from '../../modal/EditTargetDialog';
import { devLog } from '@/shared/lib/logger';
import {
  computeProgressAgainstMonthlyTarget,
  normalizeMonthlyTargetValue,
} from '../../utils/performanceEmployeeMetrics';

interface ContentPlannerTabProps {
  contentManagers: ContentManager[];
  digitalEmployees?: DigitalMarketingEmployee[];
  handleEditTarget: (manager: ContentManager) => void;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedMonth: Date;
  setSelectedMonth: React.Dispatch<React.SetStateAction<Date>>;
}

const ContentPlannerTab: React.FC<ContentPlannerTabProps> = ({
  contentManagers,
  digitalEmployees: digitalEmployeesProp,
  handleEditTarget,
  selectedDate: dailyTargetDate,
  setSelectedDate: setDailyTargetDate,
  selectedMonth: monthlyTargetDate,
  setSelectedMonth: setMonthlyTargetDate,
}) => {
  const [currentPICPage, setCurrentPICPage] = useState(0);
  const [isDailyDateEditing, setIsDailyDateEditing] = useState(false);
  const [isMonthlyDateEditing, setIsMonthlyDateEditing] = useState(false);
  const [isEditTargetDialogOpen, setIsEditTargetDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  
  const dailyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const monthlyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: digitalEmployeesFromHook = [] } = useDigitalMarketingEmployees();
  const digitalEmployees = digitalEmployeesProp?.length ? digitalEmployeesProp : digitalEmployeesFromHook;
  const { selectedJobPositionId } = usePICFilter();
  const { contentPlans, refreshContentPlans } = useOptimizedSocialMedia();
  const { targets } = useEmployeeTargets();

  // Refetch content plans on mount so Content Planner shows current data (fixes stale count after deletes)
  useEffect(() => {
    refreshContentPlans?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter employees based on selected job position
  const filteredEmployees = selectedJobPositionId 
    ? digitalEmployees.filter(emp => emp.job_position_id === selectedJobPositionId)
    : digitalEmployees;

  // Auto-revert functionality for daily date
  useEffect(() => {
    const today = new Date();
    const isDifferentDay = dailyTargetDate.getDate() !== today.getDate() || 
                          dailyTargetDate.getMonth() !== today.getMonth() ||
                          dailyTargetDate.getFullYear() !== today.getFullYear();
    
    if (isDifferentDay && dailyTimeoutRef.current) {
      clearTimeout(dailyTimeoutRef.current);
    }
    
    if (isDifferentDay) {
      dailyTimeoutRef.current = setTimeout(() => {
        setDailyTargetDate(new Date());
      }, 5000);
    }
    
    return () => {
      if (dailyTimeoutRef.current) {
        clearTimeout(dailyTimeoutRef.current);
      }
    };
  }, [dailyTargetDate]);

  // Auto-revert functionality for monthly date
  useEffect(() => {
    const today = new Date();
    const isDifferentMonth = monthlyTargetDate.getMonth() !== today.getMonth() ||
                            monthlyTargetDate.getFullYear() !== today.getFullYear();
    
    if (isDifferentMonth && monthlyTimeoutRef.current) {
      clearTimeout(monthlyTimeoutRef.current);
    }
    
    if (isDifferentMonth) {
      monthlyTimeoutRef.current = setTimeout(() => {
        setMonthlyTargetDate(new Date());
      }, 5000);
    }
    
    return () => {
      if (monthlyTimeoutRef.current) {
        clearTimeout(monthlyTimeoutRef.current);
      }
    };
  }, [monthlyTargetDate]);

  // Helper function to extract date string from date value (same as ProductionTab)
  const getDateString = (dateValue: string | Date | null | undefined): string | null => {
    if (!dateValue) return null;
    
    try {
      if (typeof dateValue === 'string') {
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        // If contains 'T', split and take date part
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0];
        }
        // If contains space, split and take date part (format: "YYYY-MM-DD HH:mm:ss")
        if (dateValue.includes(' ')) {
          return dateValue.split(' ')[0];
        }
        // Otherwise, try to parse it
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          // Use local date to avoid timezone issues
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) {
          // Use local date to avoid timezone issues
          const year = dateValue.getFullYear();
          const month = String(dateValue.getMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    } catch (e) {
      // Silently fail and return null
    }
    
    return null;
  };

  // Calculate daily approved count for specific PIC and exact date
  // Rule: Plan always belongs to month of post_date. Use completion_date for the day ONLY if
  // completion_date is in the same month as post_date. If completion_date is outside post_date's
  // month, use post_date for the day (plan never "jumps" to another month).
  const calculateDailyApproved = (picId: string, targetDate: Date) => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const targetDateString = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    return contentPlans.filter(plan => {
      if (!plan.pic_id || plan.pic_id !== picId || plan.approved !== true || !plan.post_date) {
        return false;
      }

      const postDateStr = getDateString(plan.post_date);
      if (!postDateStr) return false;

      const postDate = new Date(postDateStr + 'T00:00:00');
      const postYear = postDate.getFullYear();
      const postMonth = postDate.getMonth();

      // Plan must belong to target month (by post_date) - never count in another month
      if (postYear !== targetYear || postMonth !== targetMonth) {
        return false;
      }

      // For the day: use completion_date only if it's in same month as post_date
      const completionDateStr = getDateString(plan.completion_date);
      let effectiveDateStr: string;

      if (completionDateStr) {
        const completionDate = new Date(completionDateStr + 'T00:00:00');
        const compYear = completionDate.getFullYear();
        const compMonth = completionDate.getMonth();
        // completion_date in same month as post_date? use it for the day
        if (compYear === postYear && compMonth === postMonth) {
          effectiveDateStr = completionDateStr;
        } else {
          // completion_date outside post_date month -> use post_date
          effectiveDateStr = postDateStr;
        }
      } else {
        effectiveDateStr = postDateStr;
      }

      return effectiveDateStr === targetDateString;
    }).length;
  };

  // Calculate monthly approved count for specific PIC and month/year
  const calculateMonthlyApproved = (picId: string, targetDate: Date) => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const filteredPlans = contentPlans.filter(plan => {
      if (!plan.pic_id || plan.pic_id !== picId || !plan.approved || !plan.post_date) {
        return false;
      }

      const postDateStr = getDateString(plan.post_date);
      if (!postDateStr) return false;
      const planDate = new Date(postDateStr + 'T00:00:00');
      return (
        planDate.getFullYear() === targetYear &&
        planDate.getMonth() === targetMonth &&
        plan.approved === true
      );
    });

    return filteredPlans.length;
  };

  // Calculate on time rate for content planning (completion_date vs scheduled post_date, calendar days)
  const calculateOnTimeRate = (picId: string, targetDate: Date): number | null => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const monthlyPlans = contentPlans.filter(plan => {
      if (!plan.pic_id || plan.pic_id !== picId || !plan.approved || !plan.post_date) {
        return false;
      }

      const postDateStr = getDateString(plan.post_date);
      if (!postDateStr) return false;
      const planDate = new Date(postDateStr + 'T00:00:00');
      return (
        planDate.getFullYear() === targetYear &&
        planDate.getMonth() === targetMonth &&
        plan.approved === true
      );
    });

    if (monthlyPlans.length === 0) return null;

    const onTimePlans = monthlyPlans.filter(plan => {
      const completionStr = getDateString(plan.completion_date);
      const postStr = getDateString(plan.post_date);
      if (completionStr && postStr) {
        return completionStr <= postStr;
      }
      return true;
    });

    return Math.round((onTimePlans.length / monthlyPlans.length) * 100);
  };

  // Track logged calculations to avoid duplicate logs
  const loggedCalculationsRef = useRef<Set<string>>(new Set());

  // Calculate effective rate based on content produced and revision counts
  const calculateEffectiveRate = (picId: string, targetDate: Date) => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    
    // Get all approved content plans for this PIC in the target month (same month boundary as On Time Rate)
    const monthlyPlans = contentPlans.filter(plan => {
      if (!plan.pic_id || plan.pic_id !== picId || !plan.approved || !plan.post_date) {
        return false;
      }

      const postDateStr = getDateString(plan.post_date);
      if (!postDateStr) return false;
      const planDate = new Date(postDateStr + 'T00:00:00');
      return (
        planDate.getFullYear() === targetYear &&
        planDate.getMonth() === targetMonth &&
        plan.approved === true
      );
    });

    if (monthlyPlans.length === 0) return 100;

    // Calculate total revisions for the month
    const totalRevisions = monthlyPlans.reduce((sum, plan) => {
      return sum + (plan.revision_count || 0);
    }, 0);

    // Calculate effective rate: higher revision count = lower effective rate
    // Formula: 100 - (average revisions per content * 10)
    // This means: 0 revisions = 100%, 1 revision = 90%, 2 revisions = 80%, etc.
    const averageRevisionsPerContent = totalRevisions / monthlyPlans.length;
    const effectiveRate = Math.max(0, Math.round(100 - (averageRevisionsPerContent * 10)));
    
    // Only log once per unique calculation (picId + month combination)
    const logKey = `${picId}-${targetYear}-${targetMonth}-${effectiveRate}`;
    if (!loggedCalculationsRef.current.has(logKey)) {
      loggedCalculationsRef.current.add(logKey);
      // Clear old entries periodically to prevent memory leak
      if (loggedCalculationsRef.current.size > 100) {
        loggedCalculationsRef.current.clear();
      }
      devLog.debug('📊 Effective Rate Calculation (Content Planning):', {
        picId,
        totalContent: monthlyPlans.length,
        totalRevisions,
        averageRevisionsPerContent,
        effectiveRate
      });
    }

    return effectiveRate;
  };

  // Get target for specific employee
  const getEmployeeTarget = (employeeId: string) => {
    return targets.find(target => 
      target.employee_id === employeeId && 
      target.target_type === 'content_planning' &&
      target.status === 'active'
    );
  };

  // Get actual PIC names from content plans with calculated metrics
  const getActualPICData = () => {
    const picData = [];
    
    // Get unique PICs from content plans
    const uniquePICs = new Set();
    contentPlans.forEach(plan => {
      if (plan.pic_id && !uniquePICs.has(plan.pic_id)) {
        uniquePICs.add(plan.pic_id);
        
        const employee = digitalEmployees.find(emp => emp.id === plan.pic_id);
        if (employee) {
          const dailyApprovedCount = calculateDailyApproved(plan.pic_id, dailyTargetDate);
          const monthlyApprovedCount = calculateMonthlyApproved(plan.pic_id, monthlyTargetDate);
          const onTimeRate = calculateOnTimeRate(plan.pic_id, monthlyTargetDate);
          const effectiveRate = calculateEffectiveRate(plan.pic_id, monthlyTargetDate);
          const employeeTarget = getEmployeeTarget(employee.id);
          
          const currentValue = monthlyApprovedCount; // Use monthly approved count as current value
          const targetValue = normalizeMonthlyTargetValue(employeeTarget?.target_value);
          const progress = computeProgressAgainstMonthlyTarget(currentValue, targetValue);
          
          // Reference: average of Progress, On Time Rate, and Effective Rate (missing on-time sample → 0 like reference)
          const score = Math.round(
            (progress + (onTimeRate ?? 0) + effectiveRate) / 3
          );
          
          picData.push({
            id: employee.id,
            name: employee.full_name,
            pic: employee.full_name.split(' ').map(n => n[0]).join('').toUpperCase(),
            dailyTarget: dailyApprovedCount,
            monthlyTarget: monthlyApprovedCount,
            targetAdjusted: targetValue,
            currentValue: currentValue,
            progress: progress,
            onTimeRate: onTimeRate,
            effectiveRate: effectiveRate,
            score: score,
            hasTarget: !!employeeTarget,
            targetStatus: employeeTarget?.status || 'none'
          });
        }
      }
    });
    
    return picData;
  };

  const displayData = getActualPICData().slice(currentPICPage * 2, (currentPICPage + 1) * 2);
  
  // Ensure exactly 2 rows
  while (displayData.length < 2) {
    displayData.push({
      id: '',
      name: '',
      pic: '',
      dailyTarget: 0,
      monthlyTarget: 0,
      targetAdjusted: 0,
      currentValue: 0,
      progress: 0,
      onTimeRate: null,
      effectiveRate: 0,
      score: 0,
      hasTarget: false,
      targetStatus: 'none'
    });
  }

  const handleDailyDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate) {
      const [y, m, d] = newDate.split('-').map(Number);
      setDailyTargetDate(new Date(y, m - 1, d));
    }
    setIsDailyDateEditing(false);
  };

  const handleMonthlyDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate) {
      setMonthlyTargetDate(new Date(newDate + '-01'));
    }
    setIsMonthlyDateEditing(false);
  };

  const handlePreviousPIC = () => {
    setCurrentPICPage(Math.max(0, currentPICPage - 1));
  };

  const handleNextPIC = () => {
    const actualPICCount = getActualPICData().length;
    const maxPage = Math.ceil(actualPICCount / 2) - 1;
    setCurrentPICPage(Math.min(maxPage, currentPICPage + 1));
  };

  const handleEditTargetClick = (employee: any) => {
    if (employee.id) {
      setSelectedEmployee({ id: employee.id, name: employee.name });
      setIsEditTargetDialogOpen(true);
    }
  };

  return (
    <>
      <div className="w-full border border-gray-200 rounded-lg overflow-visible bg-white" style={{ height: '130px' }}>
        <div className="relative h-full">
          <Table className="w-full">
            <TableHeader className="sticky top-0 bg-white z-20">
              <TableRow className="border-b border-gray-200 hover:bg-transparent h-10">
                <TableHead className="w-[200px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreviousPIC}
                      className="h-5 w-5 p-0"
                      disabled={currentPICPage === 0}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="text-xs">PIC Content</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextPIC}
                      className="h-5 w-5 p-0"
                      disabled={currentPICPage >= Math.ceil(getActualPICData().length / 2) - 1}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </TableHead>
                
                <TableHead className="w-[90px] px-2 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  {isDailyDateEditing ? (
                    <input
                      type="date"
                      value={format(dailyTargetDate, 'yyyy-MM-dd')}
                      onChange={handleDailyDateChange}
                      onBlur={() => setIsDailyDateEditing(false)}
                      autoFocus
                      className="h-8 px-3 text-xs w-full border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsDailyDateEditing(true)}
                      className="h-8 px-3 text-xs w-full justify-center rounded-sm"
                    >
                      <CalendarIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate font-medium">
                        {format(dailyTargetDate, "dd MMM yyyy")}
                      </span>
                    </Button>
                  )}
                </TableHead>
                
                <TableHead className="w-[90px] px-2 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  {isMonthlyDateEditing ? (
                    <input
                      type="month"
                      value={format(monthlyTargetDate, 'yyyy-MM')}
                      onChange={handleMonthlyDateChange}
                      onBlur={() => setIsMonthlyDateEditing(false)}
                      autoFocus
                      className="h-8 px-3 text-xs w-full border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsMonthlyDateEditing(true)}
                      className="h-8 px-3 text-xs w-full justify-center rounded-sm"
                    >
                      <CalendarIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate font-medium">
                        {format(monthlyTargetDate, "MMM yyyy")}
                      </span>
                    </Button>
                  )}
                </TableHead>
                 
                <TableHead className="w-[120px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  Target Adjusted
                </TableHead>
                
                <TableHead className="w-[140px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  Progress
                </TableHead>
                
                <TableHead className="w-[110px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  On Time Rate
                </TableHead>
                
                <TableHead className="w-[110px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  Effective Rate
                </TableHead>
                
                <TableHead className="w-[80px] px-3 py-2 text-center font-medium text-xs border-r border-gray-200 bg-white h-10">
                  Score
                </TableHead>
                
                <TableHead className="w-[80px] px-3 py-2 text-center font-medium text-xs bg-white h-10">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {displayData.map((manager, index) => (
                <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-100 h-10">
                  <TableCell className="w-[200px] px-3 py-2 border-r border-gray-100 h-10">
                    {manager.name ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium relative">
                          {manager.pic}
                          {manager.hasTarget && (
                            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                              manager.targetStatus === 'completed' ? 'bg-green-500' :
                              manager.targetStatus === 'overdue' ? 'bg-red-500' :
                              manager.targetStatus === 'active' ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate">{manager.name}</span>
                      </div>
                    ) : (
                      <div className="h-6 flex items-center justify-center">
                        <span className="text-xs text-gray-400">-</span>
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[90px] px-2 py-2 text-center border-r border-gray-100 h-10">
                    <span className="text-xs font-semibold tabular-nums text-primary">{manager.dailyTarget || 0}</span>
                  </TableCell>
                  
                  <TableCell className="w-[90px] px-2 py-2 text-center border-r border-gray-100 h-10">
                    <span className="text-xs font-semibold tabular-nums text-primary">{manager.monthlyTarget || 0}</span>
                  </TableCell>
                  
                  <TableCell className="w-[120px] px-3 py-2 text-center border-r border-gray-100 h-10">
                    {manager.name && manager.hasTarget ? (
                      <span className="text-xs font-semibold tabular-nums text-primary">
                        {manager.currentValue}/{manager.targetAdjusted}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[140px] px-3 py-2 border-r border-gray-100 h-10">
                    <ProgressBar 
                      current={manager.currentValue || 0} 
                      target={manager.hasTarget ? manager.targetAdjusted || 0 : 0}
                      color="primary"
                    />
                  </TableCell>
                  
                  <TableCell className="w-[110px] px-3 py-2 text-center border-r border-gray-100 h-10">
                    {manager.name ? (
                      manager.onTimeRate !== null && manager.onTimeRate !== undefined ? (
                        <span className="text-xs font-medium tabular-nums text-primary">{manager.onTimeRate}%</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[110px] px-3 py-2 text-center border-r border-gray-100 h-10">
                    {manager.name ? (
                      <span className="text-xs font-medium tabular-nums text-primary">{manager.effectiveRate}%</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[80px] px-3 py-2 text-center border-r border-gray-100 h-10">
                    {manager.name ? (
                      <span className="text-xs font-bold tabular-nums text-primary">{manager.score}</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[80px] px-3 py-2 text-center h-10">
                    {manager.name ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditTargetClick(manager)}
                        className="h-6 px-2 text-xs"
                        title={manager.hasTarget ? 'Edit target' : 'Create target'}
                      >
                        {manager.hasTarget ? <Edit className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                      </Button>
                    ) : (
                      <div className="h-6"></div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditTargetDialog
        isOpen={isEditTargetDialogOpen}
        onClose={() => {
          setIsEditTargetDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employeeId={selectedEmployee?.id}
        employeeName={selectedEmployee?.name}
        targetType="content_planning"
        existingTarget={selectedEmployee ? getEmployeeTarget(selectedEmployee.id) : undefined}
      />
    </>
  );
};

export default ContentPlannerTab;
