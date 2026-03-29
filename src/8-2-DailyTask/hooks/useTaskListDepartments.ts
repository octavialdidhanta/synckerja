import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import type { Task } from '../types';

export function useTaskListDepartments(tasks: Task[]) {
  const [departmentMap, setDepartmentMap] = useState<Record<string, { id: string; name: string }>>({});

  useEffect(() => {
    const fetchDepartments = async () => {
      if (tasks.length === 0) return;

      const taskIds = tasks.map((t) => t.id);

      try {
        const { data: assignments, error: assignmentError } = await supabase
          .from('daily_tasks_assigned')
          .select(
            `
            daily_task_id, 
            department_id,
            employee_id,
            employee:employees!employee_id(department_id)
          `
          )
          .in('daily_task_id', taskIds);

        if (assignmentError) {
          console.error('Error fetching assignments:', assignmentError);
          return;
        }

        const departmentIds = new Set<string>();
        const taskDeptMapping: Array<{ taskId: string; deptId: string }> = [];

        (assignments || []).forEach((assignment: any) => {
          let deptId = assignment.department_id;
          if (!deptId && assignment.employee_id && assignment.employee?.department_id) {
            deptId = assignment.employee.department_id;
          }
          if (deptId) {
            departmentIds.add(deptId);
            taskDeptMapping.push({ taskId: assignment.daily_task_id, deptId });
          }
        });

        if (departmentIds.size === 0) {
          setDepartmentMap({});
          return;
        }

        const { data: departments, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', Array.from(departmentIds));

        if (deptError) {
          console.error('Error fetching departments:', deptError);
          return;
        }

        const deptMap: Record<string, { id: string; name: string }> = {};
        (departments || []).forEach((dept: any) => {
          deptMap[dept.id] = { id: dept.id, name: dept.name };
        });

        const taskDeptMap: Record<string, { id: string; name: string }> = {};
        taskDeptMapping.forEach(({ taskId, deptId }) => {
          if (deptMap[deptId]) {
            taskDeptMap[taskId] = deptMap[deptId];
          }
        });

        setDepartmentMap(taskDeptMap);
      } catch (error) {
        console.error('Error in fetchDepartments:', error);
      }
    };

    fetchDepartments();
  }, [tasks]);

  return departmentMap;
}
