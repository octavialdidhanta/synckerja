import React from 'react';
import { ApprovalAccessTable } from './ApprovalAccessTable';

interface ApprovalAccessSectionProps {
  approvalConfigs: any[];
  isLoading: boolean;
  isAdmin: boolean;
  onAddConfig: () => void;
  onUpdateConfig: (id: string, updates: any) => Promise<void>;
  onDeleteConfig: (id: string) => Promise<void>;
  onEditConfig: (config: any) => void;
}

export const ApprovalAccessSection: React.FC<ApprovalAccessSectionProps> = ({
  approvalConfigs,
  isLoading,
  isAdmin,
  onAddConfig,
  onUpdateConfig,
  onDeleteConfig,
  onEditConfig
}) => {
  if (isLoading) {
    return null;
  }

  return (
    <div>
      <ApprovalAccessTable
        configs={approvalConfigs}
        onUpdate={onUpdateConfig}
        onDelete={onDeleteConfig}
        onEdit={onEditConfig}
        canManage={isAdmin}
      />
    </div>
  );
};
