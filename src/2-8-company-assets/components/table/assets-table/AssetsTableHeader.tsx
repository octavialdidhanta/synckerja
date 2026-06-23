import React from 'react';
import { TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { COMPANY_ASSET_TABLE_COLUMN_CLASS } from './companyAssetTableColumns';

const headClass = (column: keyof typeof COMPANY_ASSET_TABLE_COLUMN_CLASS) =>
  `h-9 whitespace-nowrap bg-muted/50 text-xs font-semibold text-foreground ${COMPANY_ASSET_TABLE_COLUMN_CLASS[column]}`;

export const AssetsTableHeader = () => {
  const { t } = useAppTranslation();

  return (
    <TableHeader className="sticky top-0 z-20 bg-muted/50 shadow-sm">
      <TableRow className="hover:bg-transparent">
        <TableHead className={headClass('asset')}>Asset</TableHead>
        <TableHead className={headClass('type')}>Type</TableHead>
        <TableHead className={headClass('serialNumber')}>Serial Number</TableHead>
        <TableHead className={headClass('brandModel')}>Brand/Model</TableHead>
        <TableHead className={headClass('status')}>Status</TableHead>
        <TableHead className={headClass('heldBy')}>
          {t('companyAssets.assignedTo', 'Held by')}
        </TableHead>
        <TableHead className={headClass('holderDepartment')}>
          {t('companyAssets.assignedDepartment', "Holder's department")}
        </TableHead>
        <TableHead className={headClass('condition')}>Condition</TableHead>
        <TableHead className={headClass('requestedBy')}>
          {t('companyAssets.requestedBy', 'Requested by')}
        </TableHead>
        <TableHead className={headClass('department')}>
          {t('companyAssets.department', 'Department')}
        </TableHead>
        <TableHead className={headClass('receipt')}>Receipt</TableHead>
        <TableHead className={headClass('purchasePrice')}>Purchase Price</TableHead>
        <TableHead className={headClass('purchaseDate')}>Purchase Date</TableHead>
        <TableHead className={headClass('actions')}>Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
