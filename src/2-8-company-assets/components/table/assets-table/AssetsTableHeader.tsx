import React from 'react';
import { TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export const AssetsTableHeader = () => {
  const { t } = useAppTranslation();
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-semibold text-foreground">Asset</TableHead>
        <TableHead className="font-semibold text-foreground">Type</TableHead>
        <TableHead className="font-semibold text-foreground">Serial Number</TableHead>
        <TableHead className="font-semibold text-foreground">Brand/Model</TableHead>
        <TableHead className="font-semibold text-foreground">Status</TableHead>
        <TableHead className="font-semibold text-foreground">{t('companyAssets.assignedTo', 'Held by')}</TableHead>
        <TableHead className="font-semibold text-foreground">{t('companyAssets.assignedDepartment', "Holder's department")}</TableHead>
        <TableHead className="font-semibold text-foreground">Condition</TableHead>
        <TableHead className="font-semibold text-foreground">{t('companyAssets.requestedBy', 'Requested by')}</TableHead>
        <TableHead className="font-semibold text-foreground">{t('companyAssets.department', 'Department')}</TableHead>
        <TableHead className="font-semibold text-foreground">Receipt</TableHead>
        <TableHead className="font-semibold text-foreground">Purchase Price</TableHead>
        <TableHead className="font-semibold text-foreground">Purchase Date</TableHead>
        <TableHead className="font-semibold text-foreground">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
