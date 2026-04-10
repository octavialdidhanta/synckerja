import React from 'react';
import { CheckSquare } from 'lucide-react';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

export const EmptyState: React.FC = () => {
  const { t } = useAppTranslation();
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-card/40 p-6 text-center text-sm text-muted-foreground">
      <CheckSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
      <p className="font-medium text-foreground">{t('dailyTask.emptyTitle', 'No tasks found')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('dailyTask.emptyDescription', 'Create your first task to get started')}
      </p>
    </div>
  );
};

