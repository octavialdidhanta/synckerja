import { useMemo, useCallback } from 'react';
import { Task, TaskStep } from '../types';
import type { SummaryData } from '../types';
import { calculateProgress } from '../utils/taskUtils';
import { startOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';

export interface TaskFilters {
  search: string;
  status: string;
  priority: string;
  dateFilter: string;
  dateRange?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  planDateRange?: 'this_month_plan' | 'next_month_plan' | 'last_month_plan' | 'custom_month_plan';
  customPlanMonth?: string; // Format: YYYY-MM-01
  pic: string;
  picLevel?: 'task' | 'step' | 'sub_step' | 'all'; // Level filter untuk PIC: task, step, sub_step, atau semua
  myTask?: 'all' | 'my_task';
  department?: string;
  /** When 'unlinked', only show tasks with no Individual Objective. */
  objectiveLink?: 'all' | 'unlinked';
}

interface UseTaskFiltersProps {
  tasks: Task[];
  filters: TaskFilters;
  currentUserId?: string;
  currentEmployeeId?: string;
  departmentMap?: Record<string, { id: string; name: string }>; // Map task ID to department
  isOwner?: boolean; // Whether current user is Owner role
}

/**
 * Custom hook untuk memisahkan logika filter tasks
 * Menggunakan early exit pattern untuk optimasi performa
 */
export const useTaskFilters = ({
  tasks,
  filters,
  currentUserId,
  currentEmployeeId,
  departmentMap = {},
  isOwner = false,
}: UseTaskFiltersProps) => {
  /**
   * Check if task should be shown in "My Task" filter
   */
  const isMyTask = useCallback(
    (task: Task): boolean => {
      if (!currentUserId && !currentEmployeeId) {
        return false;
      }

      // Task created by user
      if (task.created_by === currentUserId) {
        return true;
      }

      // Task assigned to current employee at task level
      if (task.assigned_to === currentEmployeeId) {
        return true;
      }

      // Task has step/sub-step assigned to current employee
      const hasStepAssignedToCurrentUser = task.steps?.some(
        (step) =>
          step.assigned_to === currentEmployeeId ||
          step.sub_steps?.some((subStep) => subStep.assigned_to === currentEmployeeId)
      );

      return hasStepAssignedToCurrentUser || false;
    },
    [currentUserId, currentEmployeeId]
  );

  /**
   * Check if task has step assigned to specific PIC
   * Also checks sub-steps
   */
  const hasStepAssignedToPic = useCallback(
    (task: Task, picId: string): boolean => {
      return (
        task.steps?.some((step) => {
          // Check if step is assigned to PIC
          const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
          if (stepAssignedEmployeeId && String(stepAssignedEmployeeId) === String(picId)) {
            return true;
          }
          
          // Check if any sub-step is assigned to PIC
          return step.sub_steps?.some((subStep) => {
            const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
            return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(picId);
          }) || false;
        }) || false
      );
    },
    []
  );

  /**
   * Check if task matches search filter
   */
  const matchesSearch = useCallback(
    (task: Task, searchTerm: string): boolean => {
      if (!searchTerm) return true;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const taskTitleMatch = task.title?.toLowerCase().includes(lowerSearchTerm) || false;
      const taskDescriptionMatch =
        task.description?.toLowerCase().includes(lowerSearchTerm) || false;
      const stepMatch =
        task.steps?.some((step) => step.title?.toLowerCase().includes(lowerSearchTerm)) ||
        false;

      return taskTitleMatch || taskDescriptionMatch || stepMatch;
    },
    []
  );

  /**
   * Check if task matches date range filter
   */
  const matchesDateRange = useCallback(
    (task: Task): boolean => {
      // If no date filter or filter is 'all', show the task
      if (!filters.dateRange || filters.dateRange === 'all') {
        return true;
      }

      const now = new Date();

      // Helper: determine if a given ISO date string falls within the active filter
      const isInActiveRange = (isoDate?: string | null): boolean => {
        if (!isoDate) return false;
        const date = new Date(isoDate);

        switch (filters.dateRange) {
          case 'today': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            return date >= start && date < end;
          }
          case 'yesterday': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return date >= start && date < end;
          }
          case 'this_week': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            return date >= start && date < end;
          }
          case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return date >= start && date < end;
          }
          case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 1);
            return date >= start && date < end;
          }
          case 'custom': {
            if (filters.customStartDate && filters.customEndDate) {
              const start = new Date(filters.customStartDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(filters.customEndDate);
              end.setHours(23, 59, 59, 999);
              return date >= start && date <= end;
            }
            return true;
          }
          default:
            return true;
        }
      };

      // Helper: determine overdue (date in past) for task or step
      const isOverdueDate = (isoDate?: string | null): boolean => {
        if (!isoDate) return false;
        const date = new Date(isoDate);
        return date.getTime() < now.getTime();
      };

      // Match if task-level due date is in range
      if (isInActiveRange(task.due_date)) {
        return true;
      }

      // Also match if ANY step-level assigned due date is in range
      const stepHasDueInRange =
        Array.isArray(task.steps) &&
        task.steps.some((step) => isInActiveRange(step.assigned_due_date || null));

      if (stepHasDueInRange) {
        return true;
      }

      // Include overdue only for preset month ranges (this_month, last_month), not for "today" / "yesterday" / "this_week" / "custom"
      // so that "Today" and "Custom range" (e.g. November 2025) show only tasks due in that range
      const isStrictRange = ['today', 'yesterday', 'this_week', 'custom'].includes(filters.dateRange);
      if (!isStrictRange) {
        // - Task overdue (task.due_date past) and task not completed
        if (isOverdueDate(task.due_date) && (task.status !== 'completed')) {
          return true;
        }
        // - Any step overdue (step.assigned_due_date past) and step not completed
        const hasOverdueStep =
          Array.isArray(task.steps) &&
          task.steps.some(
            (step) => isOverdueDate(step.assigned_due_date || null) && step.is_completed !== true
          );
        if (hasOverdueStep) {
          return true;
        }
      }

      return false;
    },
    [filters.dateRange, filters.customStartDate, filters.customEndDate]
  );

  /**
   * Check if task matches plan date range filter
   */
  const matchesPlanDateRange = useCallback(
    (task: Task): boolean => {
      // If no plan date filter, show the task
      if (!filters.planDateRange) {
        return true;
      }

      // If task has no plan_date, exclude it when plan date filter is active
      if (!task.plan_date) {
        return false;
      }

      const planDate = startOfMonth(new Date(task.plan_date));
      const now = new Date();
      const currentMonth = startOfMonth(now);

      switch (filters.planDateRange) {
        case 'this_month_plan': {
          return isSameMonth(planDate, currentMonth);
        }
        case 'next_month_plan': {
          const nextMonth = addMonths(currentMonth, 1);
          return isSameMonth(planDate, nextMonth);
        }
        case 'last_month_plan': {
          const lastMonth = subMonths(currentMonth, 1);
          return isSameMonth(planDate, lastMonth);
        }
        case 'custom_month_plan': {
          if (filters.customPlanMonth) {
            const customMonth = startOfMonth(new Date(filters.customPlanMonth));
            return isSameMonth(planDate, customMonth);
          }
          return true;
        }
        default:
          return true;
      }
    },
    [filters.planDateRange, filters.customPlanMonth]
  );

  /**
   * Helper function untuk mendapatkan status priority
   * Urutan: Pending (1) > In Progress (2) > Completed (3) > Cancelled (4)
   */
  const getStatusPriority = useCallback((status: string | null | undefined): number => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 1; // Paling atas
      case 'in_progress':
        return 2; // Di tengah
      case 'completed':
        return 3; // Di bawah
      case 'cancelled':
        return 4; // Paling bawah
      default:
        return 5; // Status lain di paling bawah
    }
  }, []);

  /**
   * Helper function untuk mendapatkan progress task
   * Menggunakan calculateProgress dari utils
   */
  const getTaskProgress = useCallback((task: Task): number => {
    if (task.steps && task.steps.length > 0) {
      return calculateProgress(task.steps, task.status);
    }
    // Jika task tanpa steps, cek status
    if (task.status === 'completed') return 100;
    if (task.status === 'in_progress') return 0; // Default untuk in_progress tanpa steps
    return 0;
  }, []);

  /**
   * Helper function untuk mendapatkan completed date
   * Prioritaskan finish_date, fallback ke updated_at, lalu created_at
   */
  const getCompletedDate = useCallback((task: Task): Date | null => {
    // Prioritaskan finish_date
    if (task.finish_date) {
      return new Date(task.finish_date);
    }
    // Fallback ke updated_at jika finish_date null
    if (task.updated_at) {
      return new Date(task.updated_at);
    }
    // Fallback terakhir ke created_at
    if (task.created_at) {
      return new Date(task.created_at);
    }
    return null;
  }, []);

  /**
   * Filter tasks dengan early exit pattern untuk optimasi
   * Perbaikan: Memastikan "All PIC" menampilkan semua tasks
   * Ditambahkan: Auto-sorting berdasarkan status dan sub-criteria
   */
  const filteredTasks = useMemo(() => {
    // Defensive check: if tasks array is empty, return empty array
    if (!tasks || tasks.length === 0) {
      return [];
    }

    const filtered = tasks.filter((task) => {
      // Early exit 1: My Task filter
      // Hanya apply jika myTask === 'my_task', jika 'all' maka skip filter ini
      if (filters.myTask === 'my_task') {
        if (!isMyTask(task)) {
          return false;
        }
      }
      // Jika filters.myTask === 'all' atau undefined, skip filter ini (show all tasks)

      // Early exit 2: Search filter
      if (filters.search && !matchesSearch(task, filters.search)) {
        return false;
      }

      // Early exit 3: Status filter
      if (filters.status && task.status !== filters.status) {
        return false;
      }

      // Early exit 4: Priority filter
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      // Early exit 5: PIC filter dengan level filter
      // Jika filter PIC aktif, filter berdasarkan level yang dipilih (task, step, atau sub_step)
      if (filters.pic) {
        const picLevel = filters.picLevel || 'task'; // Default ke 'task' jika tidak ditentukan
        
        // Check if task is assigned directly to the PIC at task level
        const taskAssignedToPic = task.assigned_to && String(task.assigned_to) === String(filters.pic);
        
        // Check if task has any step assigned to the PIC
        const hasStepAssignedToPicValue = task.steps?.some((step) => {
          const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
          return stepAssignedEmployeeId && String(stepAssignedEmployeeId) === String(filters.pic);
        }) || false;
        
        // Check if task has any sub-step assigned to the PIC
        const hasSubStepAssignedToPic = task.steps?.some((step) => 
          step.sub_steps?.some((subStep) => {
            const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
            return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
          })
        ) || false;
        
        // Filter berdasarkan level yang dipilih
        let shouldShowTask = false;
        
        switch (picLevel) {
          case 'task':
            // Hanya tampilkan jika task di-assign ke PIC (tidak peduli step/sub-step)
            shouldShowTask = taskAssignedToPic;
            break;
          case 'step':
            // Tampilkan jika ada step yang di-assign ke PIC (tidak peduli task atau sub-step)
            shouldShowTask = hasStepAssignedToPicValue;
            break;
          case 'sub_step':
            // Tampilkan jika ada sub-step yang di-assign ke PIC (tidak peduli task atau step)
            shouldShowTask = hasSubStepAssignedToPic;
            break;
          case 'all':
            // Backward compatibility: convert 'all' to 'task' behavior
            shouldShowTask = taskAssignedToPic || hasStepAssignedToPicValue || hasSubStepAssignedToPic;
            break;
          default:
            // Default to 'task' behavior
            shouldShowTask = taskAssignedToPic;
            break;
        }
        
        if (!shouldShowTask) {
          return false;
        }
      }

      // Early exit 6: Date range filter (Due date)
      // Hanya apply jika dateRange diisi dan bukan 'all'
      if (filters.dateRange && filters.dateRange !== 'all' && !matchesDateRange(task)) {
        return false;
      }

      // Early exit 7: Plan date range filter
      // Apply filter jika planDateRange diisi (AND logic dengan dateRange)
      if (filters.planDateRange && !matchesPlanDateRange(task)) {
        return false;
      }

      // Early exit 8: Department filter
      // When a department is selected, show ONLY tasks that belong to that department.
      // Tasks without department (taskDepartment undefined) are excluded so they don't appear under the filter.
      if (filters.department) {
        const taskDepartment = departmentMap?.[task.id];
        if (!taskDepartment || taskDepartment.id !== filters.department) {
          return false;
        }
      }

      // Early exit 9: Objective link filter – show only tasks with no Individual Objective
      if (filters.objectiveLink === 'unlinked') {
        if (task.objective_id) {
          return false;
        }
      }

      return true;
    });

    // Tambahkan sorting setelah filtering
    return filtered.sort((a, b) => {
      // 1. Sort berdasarkan status priority
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }

      // 2. Jika status sama, sort berdasarkan sub-criteria
      const statusA = a.status?.toLowerCase();
      const statusB = b.status?.toLowerCase();

      // Pending: sort berdasarkan due_date (null di akhir)
      if (statusA === 'pending' && statusB === 'pending') {
        const dueDateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const dueDateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return dueDateA - dueDateB; // Due date terdekat di atas
      }

      // In Progress: sort berdasarkan progress (rendah → tinggi)
      if (statusA === 'in_progress' && statusB === 'in_progress') {
        const progressA = getTaskProgress(a);
        const progressB = getTaskProgress(b);
        return progressA - progressB; // Progress rendah di atas
      }

      // Completed: sort berdasarkan finish_date (baru → lama)
      if (statusA === 'completed' && statusB === 'completed') {
        const completedDateA = getCompletedDate(a);
        const completedDateB = getCompletedDate(b);
        
        if (!completedDateA && !completedDateB) return 0;
        if (!completedDateA) return 1; // Null di bawah
        if (!completedDateB) return -1; // Null di bawah
        
        // Terbaru di atas (descending)
        return completedDateB.getTime() - completedDateA.getTime();
      }

      // Cancelled: sort berdasarkan updated_at (baru → lama)
      if (statusA === 'cancelled' && statusB === 'cancelled') {
        const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return updatedB - updatedA; // Terbaru di atas
      }

      // Default: maintain current order
      return 0;
    });
  }, [
    tasks,
    filters,
    isMyTask,
    matchesSearch,
    matchesDateRange,
    matchesPlanDateRange,
    hasStepAssignedToPic,
    getStatusPriority,
    getTaskProgress,
    getCompletedDate,
    departmentMap,
  ]);

  /**
   * Get visible steps untuk task berdasarkan filter
   */
  const getVisibleSteps = useCallback(
    (task: Task): TaskStep[] => {
      // Defensive check: if task has no steps, return empty array
      if (!task.steps || task.steps.length === 0) {
        return [];
      }

      // Helper: check if a given ISO date is within the active filter range
      const isInActiveRange = (isoDate?: string | null): boolean => {
        if (!filters.dateRange || filters.dateRange === 'all') return true;
        if (!isoDate) return false;
        const now = new Date();
        const date = new Date(isoDate);
        switch (filters.dateRange) {
          case 'today': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            return date >= start && date < end;
          }
          case 'yesterday': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return date >= start && date < end;
          }
          case 'this_week': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            return date >= start && date < end;
          }
          case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return date >= start && date < end;
          }
          case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 1);
            return date >= start && date < end;
          }
          case 'custom': {
            if (filters.customStartDate && filters.customEndDate) {
              const start = new Date(filters.customStartDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(filters.customEndDate);
              end.setHours(23, 59, 59, 999);
              return date >= start && date <= end;
            }
            return true;
          }
          default:
            return true;
        }
      };

      // Check if user is task creator or task is assigned at task level
      const isTaskCreator = task.created_by === currentUserId;
      const isTaskAssignedToUser = task.assigned_to === currentEmployeeId;
      const shouldShowAllSteps = isTaskCreator || isTaskAssignedToUser;

      // Priority 1: Individual PIC filter dengan level filter
      // PIC filter harus diutamakan - jika PIC filter aktif, filter berdasarkan level yang dipilih
      // KECUALI untuk Owner: Owner selalu melihat semua steps dan sub-steps
      let steps = task.steps;
      const picLevel = filters.picLevel || 'task'; // Default ke 'task' jika tidak ditentukan
      
      // Jika filter PIC aktif dan user bukan Owner, filter steps berdasarkan PIC dan level
      // Filter PIC HARUS diutamakan - tidak peduli apakah user adalah task creator atau tidak
      if (filters.pic && !isOwner) {
        // Filter PIC berlaku untuk semua user KECUALI Owner
        // Filter berdasarkan level yang dipilih
        if (picLevel === 'task') {
          // Jika level adalah 'task', tampilkan semua step (tidak filter step berdasarkan PIC)
          // Karena task sudah difilter di level task
          steps = steps;
        } else if (picLevel === 'step') {
          // Jika level adalah 'step', hanya tampilkan step yang assigned kepada PIC
          steps = steps
            .map((step) => {
              const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
              if (!stepAssignedEmployeeId) {
                return null;
              }
              const stepMatchesPic = String(stepAssignedEmployeeId) === String(filters.pic);
              if (stepMatchesPic) {
                // Tampilkan semua sub-steps dari step yang di-assign ke PIC
                return step;
              }
              return null;
            })
            .filter((step): step is TaskStep => step !== null);
        } else if (picLevel === 'sub_step') {
          // Jika level adalah 'sub_step', hanya tampilkan step yang memiliki sub-step assigned kepada PIC
          steps = steps
            .map((step) => {
              if (step.sub_steps && step.sub_steps.length > 0) {
                const filteredSubSteps = step.sub_steps.filter(
                  (subStep) => {
                    const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                    return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                  }
                );
                if (filteredSubSteps.length > 0) {
                  return {
                    ...step,
                    sub_steps: filteredSubSteps,
                  };
                }
              }
              return null;
            })
            .filter((step): step is TaskStep => step !== null);
        } else if (picLevel === 'all') {
          // Backward compatibility: 'all' behavior - filter step dan sub-step berdasarkan PIC
          steps = steps
            .map((step) => {
              const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
              
              if (!stepAssignedEmployeeId) {
                // Jika step tidak memiliki assignment, cek apakah ada sub-step yang assigned kepada PIC
                if (step.sub_steps && step.sub_steps.length > 0) {
                  const filteredSubSteps = step.sub_steps.filter(
                    (subStep) => {
                      const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                      return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                    }
                  );
                  if (filteredSubSteps.length > 0) {
                    return {
                      ...step,
                      sub_steps: filteredSubSteps,
                    };
                  }
                }
                return null;
              }
              
              const stepMatchesPic = String(stepAssignedEmployeeId) === String(filters.pic);
              
              if (!stepMatchesPic && step.sub_steps && step.sub_steps.length > 0) {
                const filteredSubSteps = step.sub_steps.filter(
                  (subStep) => {
                    const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                    return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                  }
                );
                if (filteredSubSteps.length > 0) {
                  return {
                    ...step,
                    sub_steps: filteredSubSteps,
                  };
                }
                return null;
              }
              
              if (stepMatchesPic) {
                const filteredSubSteps = step.sub_steps?.filter(
                  (subStep) => {
                    const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                    return !subStepAssignedEmployeeId || String(subStepAssignedEmployeeId) === String(filters.pic);
                  }
                ) || step.sub_steps;
                return {
                  ...step,
                  sub_steps: filteredSubSteps,
                };
              }
              
              return null;
            })
            .filter((step): step is TaskStep => step !== null);
        } else {
          // Default to 'task' behavior if unknown level
          steps = steps;
        }
      } else if (filters.pic && isOwner) {
        // Untuk Owner: tampilkan semua steps, tapi tetap filter berdasarkan level yang dipilih
        if (picLevel === 'task') {
          // Jika level adalah 'task', tampilkan semua step dan sub-step
          steps = steps;
        } else if (picLevel === 'step') {
          // Jika level adalah 'step', filter step berdasarkan PIC
          steps = steps.filter((step) => {
            const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
            return stepAssignedEmployeeId && String(stepAssignedEmployeeId) === String(filters.pic);
          });
        } else if (picLevel === 'sub_step') {
          // Jika level adalah 'sub_step', hanya tampilkan step yang memiliki sub-step assigned kepada PIC
          // Step yang tidak memiliki sub-step atau tidak ada sub-step yang di-assign ke PIC tidak ditampilkan
          steps = steps
            .map((step) => {
              // Step harus memiliki sub-step
              if (!step.sub_steps || step.sub_steps.length === 0) {
                return null;
              }
              
              // Filter sub-step berdasarkan PIC
              const filteredSubSteps = step.sub_steps.filter(
                (subStep) => {
                  const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                  return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                }
              );
              
              // Hanya tampilkan step jika ada setidaknya satu sub-step yang di-assign ke PIC
              if (filteredSubSteps.length > 0) {
                return {
                  ...step,
                  sub_steps: filteredSubSteps,
                };
              }
              
              // Step tidak ditampilkan jika tidak ada sub-step yang di-assign ke PIC
              return null;
            })
            .filter((step): step is TaskStep => step !== null);
        } else if (picLevel === 'all') {
          // Backward compatibility: Level 'all' - filter sub-steps berdasarkan PIC
          steps = steps.map((step) => {
            if (step.sub_steps && step.sub_steps.length > 0) {
              const filteredSubSteps = step.sub_steps.filter(
                (subStep) => {
                  const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                  return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                }
              );
              return {
                ...step,
                sub_steps: filteredSubSteps,
              };
            }
            return step;
          });
        } else {
          // Default to 'task' behavior if unknown level
          steps = steps;
        }
      }

      // Priority 2: All PIC mode - keep current filtered list (no PIC filter)

      // Priority 3: My Task mode
      // Hanya apply jika PIC filter TIDAK aktif
      // Jika filter PIC aktif, skip filter "My Task" karena sudah difilter berdasarkan PIC
      if (!filters.pic) {
        // If task is assigned at task level to current employee, show ALL steps
        // OR if task is created by current user (task creator), show ALL steps
        // Owner selalu melihat semua steps
        if (shouldShowAllSteps || isOwner) {
          // keep steps as-is (show all steps for task creator, task assigned at task level, atau Owner)
        } else {
          // Otherwise, show only steps assigned to current employee or created by user or has assigned substeps
          steps = steps.filter(
            (step) =>
              step.assigned_to === currentEmployeeId ||
              step.created_by === currentUserId ||
              step.has_assigned_substeps
          );
        }
      }

      // Apply date range filter at step level:
      // When a date filter is active, show steps whose assigned_due_date falls in range
      // OR steps that are overdue (assigned_due_date in past) and not completed
      // Skip date range filter if user is task creator, task is assigned at task level, atau Owner
      if (filters.dateRange && filters.dateRange !== 'all' && !shouldShowAllSteps && !isOwner) {
        const now = new Date();
        const isOverdue = (step: TaskStep): boolean => {
          if (!step.assigned_due_date) return false;
          const due = new Date(step.assigned_due_date);
          // consider overdue if due date has passed and step not completed
          return due.getTime() < now.getTime() && step.is_completed !== true;
        };
        steps = steps.filter((step) => {
          const inRange = isInActiveRange(step.assigned_due_date || null);
          return inRange || isOverdue(step);
        });
      }

      // Apply search filter at step level:
      // - Exact match with task title => show all steps (but still respect PIC filter if active)
      // - Exact match with step title => show only matching steps
      // - Partial match => keep previous behavior (step titles containing keyword)
      if (filters.search) {
        const normalizedSearch = filters.search.toLowerCase().trim();
        const normalizedTaskTitle = task.title?.toLowerCase().trim() || '';
        const isExactTaskMatch = normalizedSearch.length > 0 && normalizedTaskTitle === normalizedSearch;

        if (!isExactTaskMatch) {
          const exactStepMatches = steps.filter((step) => {
            const normalizedStepTitle = step.title?.toLowerCase().trim() || '';
            return normalizedStepTitle === normalizedSearch;
          });

          if (exactStepMatches.length > 0) {
            steps = exactStepMatches;
          } else {
            steps = steps.filter((step) => {
              const stepTitleMatch = step.title?.toLowerCase().includes(normalizedSearch) || false;
              return stepTitleMatch;
            });
          }
        }
        // Note: If isExactTaskMatch is true, we keep all steps (but PIC filter will still apply in final check)
      }

      // CRITICAL: Final check - Jika filter PIC aktif dan user bukan Owner, pastikan step sesuai dengan level filter
      // Ini HARUS diterapkan setelah semua filter lain untuk memastikan tidak ada kondisi yang melewati filter PIC
      if (filters.pic && !isOwner) {
        if (picLevel === 'task') {
          // Jika level adalah 'task', tampilkan semua step (tidak perlu filter lagi)
          // Task sudah difilter di level task
        } else if (picLevel === 'step') {
          // Jika level adalah 'step', hanya tampilkan step yang assigned kepada PIC
          steps = steps.filter((step) => {
            const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
            return stepAssignedEmployeeId && String(stepAssignedEmployeeId) === String(filters.pic);
          });
        } else if (picLevel === 'sub_step') {
          // Jika level adalah 'sub_step', hanya tampilkan step yang memiliki sub-step assigned kepada PIC
          // Step yang tidak memiliki sub-step atau tidak ada sub-step yang di-assign ke PIC tidak ditampilkan
          steps = steps
            .map((step) => {
              // Step harus memiliki sub-step
              if (!step.sub_steps || step.sub_steps.length === 0) {
                return null;
              }
              
              // Filter sub-step berdasarkan PIC
              const filteredSubSteps = step.sub_steps.filter(
                (subStep) => {
                  const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                  return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                }
              );
              
              // Hanya tampilkan step jika ada setidaknya satu sub-step yang di-assign ke PIC
              if (filteredSubSteps.length > 0) {
                return {
                  ...step,
                  sub_steps: filteredSubSteps,
                };
              }
              
              // Step tidak ditampilkan jika tidak ada sub-step yang di-assign ke PIC
              return null;
            })
            .filter((step): step is TaskStep => step !== null);
        } else if (picLevel === 'all') {
          // Backward compatibility: Level 'all' - filter step dan sub-step berdasarkan PIC
          steps = steps.filter((step) => {
            const stepAssignedEmployeeId = step.assigned_employee?.id || step.assigned_to;
            if (!stepAssignedEmployeeId) {
              return step.sub_steps?.some(
                (subStep) => {
                  const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                  return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
                }
              ) || false;
            }
            const stepMatchesPic = String(stepAssignedEmployeeId) === String(filters.pic);
            const hasSubStepAssignedToPic = step.sub_steps?.some(
              (subStep) => {
                const subStepAssignedEmployeeId = subStep.assigned_employee?.id || subStep.assigned_to;
                return subStepAssignedEmployeeId && String(subStepAssignedEmployeeId) === String(filters.pic);
              }
            ) || false;
            return stepMatchesPic || hasSubStepAssignedToPic;
          });
        } else {
          // Default to 'task' behavior if unknown level - show all steps
          steps = steps;
        }
      }

      return steps;
    },
    [filters, currentEmployeeId, currentUserId, isOwner]
  );

  /**
   * Display status based on progress (same as table column):
   * Pending = 0%, In Progress = >0% and <100%, Completed = 100%.
   * Uses visible steps progress so summary and table stay in sync.
   */
  const getDisplayStatus = useCallback(
    (task: Task): string => {
      if (!task) return 'pending';
      if (task.status === 'cancelled') return 'cancelled';
      const visibleSteps = getVisibleSteps(task);
      const progress =
        visibleSteps.length > 0
          ? calculateProgress(visibleSteps, task.status)
          : task.status === 'completed'
            ? 100
            : 0;
      if (progress >= 100) return 'completed';
      if (progress > 0) return 'in_progress';
      return 'pending';
    },
    [getVisibleSteps]
  );

  /** Summary stats use display status so counts match the task list (synchronous) */
  const filteredSummaryData: SummaryData = useMemo(() => {
    const list = filteredTasks || [];
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      pending: list.filter((t) => t && getDisplayStatus(t) === 'pending').length,
      inProgress: list.filter((t) => t && getDisplayStatus(t) === 'in_progress').length,
      completed: list.filter((t) => t && getDisplayStatus(t) === 'completed').length,
      cancelled: list.filter((t) => t && getDisplayStatus(t) === 'cancelled').length,
      overdue: list.filter((t) => {
        if (!t || !t.due_date) return false;
        return new Date(t.due_date) < new Date() && getDisplayStatus(t) !== 'completed';
      }).length,
      totalSteps: list.reduce((sum, t) => sum + (t?.steps?.length || 0), 0),
      completedSteps: list.reduce(
        (sum, t) => sum + (t?.steps?.filter((s) => s && s.is_completed).length || 0),
        0
      ),
      tasksPlannedThisMonth: list.filter((t) => {
        if (!t || !t.plan_date) return false;
        const planDate = new Date(t.plan_date);
        return planDate >= currentMonthStart && planDate < nextMonthStart;
      }).length,
    };
  }, [filteredTasks, getDisplayStatus]);

  return {
    filteredTasks,
    filteredSummaryData,
    getVisibleSteps,
    isMyTask,
    hasStepAssignedToPic,
    matchesSearch,
    matchesDateRange,
  };
};

