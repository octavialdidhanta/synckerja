import React from 'react';
import { Briefcase, UserCheck, UserCircle, Clock } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface JobDescSidebarStats {
  assignments: number;
  busy: number;
  idle: number;
  pendingDays: number;
}

interface JobDescSidebarFooterProps {
  assignments: number;
  busy: number;
  idle: number;
  pendingDays: number;
}

export const JobDescSidebarFooter: React.FC<JobDescSidebarFooterProps> = ({
  assignments,
  busy,
  idle,
  pendingDays,
}) => {
  const { t } = useAppTranslation();

  return (
    <div className="min-w-0 shrink-0 border-t border-gray-200 bg-gray-50 p-3">
      <div className="grid min-w-0 w-full grid-cols-2 gap-2 text-center">
        <div className="flex flex-col items-center">
          <Briefcase className="mb-1 h-4 w-4 text-brand-blue" />
          <div className="text-xs font-semibold text-gray-900">{assignments}</div>
          <div className="text-xs text-gray-500">
            {t('dailyTask.jobDesc.metrics.activeAssignments', 'Tugas Aktif')}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <UserCheck className="w-4 h-4 text-emerald-600 mb-1" />
          <div className="text-xs font-semibold text-gray-900">{busy}</div>
          <div className="text-xs text-gray-500">
            {t('dailyTask.jobDesc.metrics.busyEmployees', 'Sibuk')}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <UserCircle className="w-4 h-4 text-amber-600 mb-1" />
          <div className="text-xs font-semibold text-gray-900">{idle}</div>
          <div className="text-xs text-gray-500">
            {t('dailyTask.jobDesc.metrics.idleEmployees', 'Idle')}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Clock className="w-4 h-4 text-gray-500 mb-1" />
          <div className="text-xs font-semibold text-gray-900">{pendingDays}</div>
          <div className="text-xs text-gray-500">
            {t('dailyTask.jobDesc.metrics.avgPendingDays', 'Rata pending (hari)')}
          </div>
        </div>
      </div>
    </div>
  );
};
