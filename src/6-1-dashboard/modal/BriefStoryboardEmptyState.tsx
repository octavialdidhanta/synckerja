import React from 'react';
import { Table2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface BriefStoryboardEmptyStateProps {
  onCreateTable: () => void;
}

export const BriefStoryboardEmptyState: React.FC<BriefStoryboardEmptyStateProps> = ({
  onCreateTable,
}) => {
  const { t } = useAppTranslation();

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <p className="text-sm text-gray-500">
        {t(
          'briefDialog.storyboard.noTableYet',
          'No storyboard table yet. Create a custom table to start the brief.',
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={onCreateTable} className="gap-2">
          <Table2 className="h-4 w-4" />
          {t('briefDialog.storyboard.createTable', 'Create table')}
        </Button>
      </div>
    </div>
  );
};
