
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit, Target } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
// import "@/styles/datepicker.css"; // File tidak ada
import { format } from 'date-fns';
import { ContentManager } from '../../types/social-media';
import { useOptimizedSocialMedia } from '../../hook/useOptimizedSocialMediaState';
import { useEmployeeTargets } from '../../hook/useEmployeeTargets';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getAllSocialMediaLinksQueryOptions } from '../../data/dashboardQueryOptions';
import { ProgressBar } from '@/shared/components/ProgressBar';
import EditTargetDialog from '../../modal/EditTargetDialog';
import {
  computeProgressAgainstMonthlyTarget,
  normalizeMonthlyTargetValue,
} from '../../utils/performanceEmployeeMetrics';
import { isPostMetricComplete } from '@/6-1-scheduled-posts/lib/derivePlanPostMetadata';

interface ContentPostTabProps {
  contentManagers: ContentManager[];
  handleEditTarget: (manager: ContentManager) => void;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedMonth: Date;
  setSelectedMonth: React.Dispatch<React.SetStateAction<Date>>;
}

const ContentPostTab: React.FC<ContentPostTabProps> = ({
  contentManagers,
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

  const { contentPlans } = useOptimizedSocialMedia();
  const { targets } = useEmployeeTargets();
  const { organizationId } = useCurrentOrg();

  const { data: allSocialMediaLinks = [] } = useQuery(
    getAllSocialMediaLinksQueryOptions(organizationId),
  );

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

  // Helper function to extract date string from date value (same as ProductionTab and ContentPlannerTab)
  // Enhanced to handle DD/MM/YYYY format
  const getDateString = (dateValue: string | Date | null | undefined): string | null => {
    if (!dateValue) return null;
    
    try {
      if (typeof dateValue === 'string') {
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        // Handle DD/MM/YYYY format (e.g., "04/11/2025")
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          return `${year}-${month}-${day}`;
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

  const getActualPostDateForPlan = useCallback(
    (plan: { id: string; actual_post_date?: string | null }) => {
      if (!plan.actual_post_date) return null;
      return getDateString(plan.actual_post_date);
    },
    []
  );

  // Calculate daily posted content count for specific PIC and exact date
  // Logic: count when done=true (toggle Done = On) OR has social media links
  // Priority: actual_post_date > post_date for date matching
  // Use useCallback to memoize function and ensure it updates when dependencies change
  // For Content Post tab, use post_link_created_by (PIC POST column) instead of pic_id
  const calculateDailyPosted = useCallback((picId: string, targetDate: Date) => {
    // Use local date to avoid timezone issues (same as ProductionTab and ContentPlannerTab)
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;
    
    return contentPlans.filter(plan => {
      // Must have post_link_created_by (PIC POST) and match the picId
      if (!plan.post_link_created_by || plan.post_link_created_by !== picId) {
        return false;
      }

      // Posted only when all required platforms are complete with valid post metadata
      if (!isPostMetricComplete(plan)) {
        return false;
      }

      // Priority: actual_post_date > post_date for date matching
      // Check actual_post_date first (most reliable - when content was actually posted)
      if (plan.actual_post_date) {
        const actualPostDateStr = getDateString(plan.actual_post_date);
        if (actualPostDateStr && actualPostDateStr === targetDateString) {
          return true;
        }
      }

      // Fallback: check post_date if actual_post_date doesn't match or doesn't exist
      // Also check post_date if actual_post_date is null/undefined but content is posted
      if (plan.post_date) {
        const postDateStr = getDateString(plan.post_date);
        if (postDateStr && postDateStr === targetDateString) {
          return true;
        }
      }

      // If no actual_post_date and post_date doesn't match, but content is posted (done=true or has links)
      // and we're looking at today's date, we might want to count it
      // But for now, we require date match - so return false
      return false;
    }).length;
  }, [contentPlans]);

  // Calculate monthly posted content count for specific PIC and month/year
  // Use useCallback to memoize function and ensure it updates when dependencies change
  // For Content Post tab, use post_link_created_by (PIC POST column) instead of pic_id
  const calculateMonthlyPosted = useCallback((picId: string, targetDate: Date) => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    
    return contentPlans.filter(plan => {
      // Must have post_link_created_by (PIC POST) and match the picId
      if (!plan.post_link_created_by || plan.post_link_created_by !== picId) {
        return false;
      }

      // Must have post_date
      if (!plan.post_date) {
        return false;
      }
      
      // Parse post_date and check if it matches target month/year
      const postDateStr = getDateString(plan.post_date);
      if (!postDateStr) {
        return false;
      }
      
      const planDate = new Date(postDateStr + 'T00:00:00');
      if (planDate.getFullYear() !== targetYear || planDate.getMonth() !== targetMonth) {
        return false;
      }
      
      // Check if content is fully posted (all required platforms + Ontime/Late status)
      return isPostMetricComplete(plan);
    }).length;
  }, [contentPlans]);

  // Calculate on time rate for content posting
  // Use useCallback to memoize function and ensure it updates when dependencies change
  // For Content Post tab, use post_link_created_by (PIC POST column) instead of pic_id
  const calculatePostingOnTimeRate = useCallback(
    (picId: string, targetDate: Date): number | null => {
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();

      const monthlyPlans = contentPlans.filter(plan => {
        if (!plan.post_link_created_by || plan.post_link_created_by !== picId || !plan.post_date) {
          return false;
        }

        const postDateStr = getDateString(plan.post_date);
        if (!postDateStr) return false;
        const planDate = new Date(postDateStr + 'T00:00:00');
        if (planDate.getFullYear() !== targetYear || planDate.getMonth() !== targetMonth) {
          return false;
        }

        return isPostMetricComplete(plan);
      });

      if (monthlyPlans.length === 0) return null;

      const onTimePlans = monthlyPlans.filter(plan => {
        const stored = String(plan.on_time_status ?? '').trim();
        if (stored === 'Ontime') return true;
        if (stored.includes('Late')) return false;
        const actualStr = getActualPostDateForPlan(plan);
        const postStr = getDateString(plan.post_date);
        if (actualStr && postStr) {
          return actualStr <= postStr;
        }
        return false;
      });

      return Math.round((onTimePlans.length / monthlyPlans.length) * 100);
    },
    [contentPlans, allSocialMediaLinks, getActualPostDateForPlan]
  );

  // Effective rate for posting: same formula as Content Planner (revision_count), on plans posted this month by this PIC
  const calculatePostingEffectiveRate = useCallback(
    (picId: string, targetDate: Date): number | null => {
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();

      const monthlyPlans = contentPlans.filter(plan => {
        if (!plan.post_link_created_by || plan.post_link_created_by !== picId || !plan.post_date) {
          return false;
        }

        const postDateStr = getDateString(plan.post_date);
        if (!postDateStr) return false;
        const planDate = new Date(postDateStr + 'T00:00:00');
        if (planDate.getFullYear() !== targetYear || planDate.getMonth() !== targetMonth) {
          return false;
        }

        return isPostMetricComplete(plan);
      });

      if (monthlyPlans.length === 0) return null;

      const totalRevisions = monthlyPlans.reduce((sum, plan) => sum + (plan.revision_count || 0), 0);
      const averageRevisionsPerContent = totalRevisions / monthlyPlans.length;
      return Math.max(0, Math.round(100 - averageRevisionsPerContent * 10));
    },
    [contentPlans, allSocialMediaLinks]
  );

  // Get target for specific employee
  const getEmployeeTarget = (employeeId: string) => {
    return targets.find(target => 
      target.employee_id === employeeId && 
      target.target_type === 'content_posting' &&
      target.status === 'active'
    );
  };

  // Get actual PIC names from content plans with calculated metrics
  // Use useMemo to recalculate when contentPlans, allSocialMediaLinks, or dates change
  // For Content Post tab, use post_link_created_by (PIC POST column) instead of pic_id
  const actualPostingPICData = useMemo(() => {
    const picData = [];
    
    // Get unique PICs from content plans based on post_link_created_by (PIC POST column)
    const uniquePICs = new Set<string>();
    contentPlans.forEach(plan => {
      // Use post_link_created_by instead of pic_id for Content Post tab
      if (plan.post_link_created_by && !uniquePICs.has(plan.post_link_created_by)) {
        uniquePICs.add(plan.post_link_created_by);
        
        // Get employee data from post_link_creator relation (already in plan data from UI)
        const employee = plan.post_link_creator;
        if (employee) {
          const dailyPostedCount = calculateDailyPosted(plan.post_link_created_by, dailyTargetDate);
          const monthlyPostedCount = calculateMonthlyPosted(plan.post_link_created_by, monthlyTargetDate);
          const onTimeRate = calculatePostingOnTimeRate(plan.post_link_created_by, monthlyTargetDate);
          const effectiveRate = calculatePostingEffectiveRate(plan.post_link_created_by, monthlyTargetDate);
          const employeeTarget = getEmployeeTarget(employee.id);
          
          const currentValue = monthlyPostedCount; // Use monthly posted count as current value
          const targetValue = normalizeMonthlyTargetValue(employeeTarget?.target_value);
          const progress = computeProgressAgainstMonthlyTarget(currentValue, targetValue);

          // Align with Planner/Production: score = avg(Progress, On Time, Effective). Reference Post used /2 without
          // effective; neutral 100 when a metric has no monthly sample (same idea as reference returning 100 for empty on-time).
          const score = Math.round(
            (progress + (onTimeRate ?? 100) + (effectiveRate ?? 100)) / 3
          );
          
          picData.push({
            id: employee.id,
            name: employee.full_name,
            pic: employee.full_name.split(' ').map(n => n[0]).join('').toUpperCase(),
            dailyTarget: dailyPostedCount,
            monthlyTarget: monthlyPostedCount,
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
  }, [
    contentPlans,
    allSocialMediaLinks,
    dailyTargetDate,
    monthlyTargetDate,
    targets,
    calculateDailyPosted,
    calculateMonthlyPosted,
    calculatePostingOnTimeRate,
    calculatePostingEffectiveRate,
  ]);

  const displayData = actualPostingPICData.slice(currentPICPage * 2, (currentPICPage + 1) * 2);
  
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
      effectiveRate: null,
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
    const actualPICCount = actualPostingPICData.length;
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
                    <span className="text-xs">PIC Content Post</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextPIC}
                      className="h-5 w-5 p-0"
                      disabled={currentPICPage >= Math.ceil(actualPostingPICData.length / 2) - 1}
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
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium relative">
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
                      manager.effectiveRate !== null && manager.effectiveRate !== undefined ? (
                        <span className="text-xs font-medium tabular-nums text-primary">{manager.effectiveRate}%</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )
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
        targetType="content_posting"
        existingTarget={selectedEmployee ? getEmployeeTarget(selectedEmployee.id) : undefined}
      />
    </>
  );
};

export default ContentPostTab;
