import { memo, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useEmployeePermissions } from '../hooks/useEmployeePermissions';
import type { Employee } from '../hooks/useEmployees';
import { getEligibleManagersForEmployee } from '../utils/employeeUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useToast } from '@/shared/hooks/use-toast';

/** Radix Select requires a non-empty string; maps to null manager_id in DB */
const MANAGER_NONE_VALUE = '__manager_none__';

interface EmployeeManagerCellProps {
  employee: Employee;
  allEmployees: Employee[];
  userRole?: string;
  currentUserEmail?: string;
  onRefresh: () => void;
}

export const EmployeeManagerCell = memo(function EmployeeManagerCell({
  employee,
  allEmployees,
  userRole,
  currentUserEmail,
  onRefresh,
}: EmployeeManagerCellProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const permissions = useEmployeePermissions({ employee, userRole, currentUserEmail });

  const eligible = useMemo(() => {
    const base = getEligibleManagersForEmployee(employee, allEmployees);
    const ids = new Set(base.map((x) => x.id));
    if (employee.manager_id) {
      const cur = allEmployees.find((e) => e.id === employee.manager_id);
      if (cur && !ids.has(cur.id)) {
        base.push(cur);
      }
    }
    return base.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' }));
  }, [employee, allEmployees]);

  const handleValueChange = useCallback(
    async (managerId: string) => {
      const nextId = managerId === MANAGER_NONE_VALUE ? null : managerId;
      const currentId = employee.manager_id ?? null;
      if (nextId === currentId) return;
      setSaving(true);
      try {
        const { error } = await supabase.from('employees').update({ manager_id: nextId }).eq('id', employee.id);
        if (error) {
          toast({
            title: t('employees.manager.updateError', 'Failed to update manager'),
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['employees-optimized'] });
        onRefresh();
      } finally {
        setSaving(false);
      }
    },
    [employee.id, employee.manager_id, onRefresh, queryClient, t, toast]
  );

  if (employee.is_organization_owner) {
    return (
      <span
        className="whitespace-nowrap text-xs text-muted-foreground"
        title={t('employees.manager.ownerLabel', 'Organization owner')}
      >
        {t('employees.manager.ownerLabel', 'Organization owner')}
      </span>
    );
  }

  const hasOwnerOption = eligible.some((c) => c.is_organization_owner);
  if (!employee.department_id && !hasOwnerOption) {
    return (
      <span
        className="text-xs text-amber-600 truncate block max-w-[200px]"
        title={t('employees.manager.noDepartmentHint', 'Set department first')}
      >
        {t('employees.manager.noDepartmentHint', 'Set department first')}
      </span>
    );
  }

  const canChange = permissions.canEdit && !saving;

  return (
    <Select
      value={employee.manager_id ?? MANAGER_NONE_VALUE}
      onValueChange={handleValueChange}
      disabled={!canChange}
    >
      <SelectTrigger className="h-8 min-w-[140px] max-w-[220px] text-xs">
        <SelectValue placeholder={t('employees.manager.selectPlaceholder', 'Select manager')} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-[280px]">
        <SelectItem value={MANAGER_NONE_VALUE} className="text-xs text-muted-foreground">
          {t('employees.manager.none', 'No manager')}
        </SelectItem>
        {eligible.map((m) => (
          <SelectItem key={m.id} value={m.id} className="text-xs">
            {m.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
