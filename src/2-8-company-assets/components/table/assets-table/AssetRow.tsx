
import React from 'react';
import { TableCell, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MoreHorizontal, Trash2, UserPlus, ArrowRightLeft, Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { COMPANY_ASSET_TABLE_COLUMN_CLASS } from './companyAssetTableColumns';

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  asset_tag: string;
  brand: string;
  model: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: number;
  notes: string;
  image_url: string;
  created_at: string;
  purchase_request_id?: string | null;
  receipt_confirmed_at?: string | null;
  requester_name?: string | null;
  department_name?: string | null;
  assigned_to_employee_id?: string | null;
  assigned_at?: string | null;
  assigned_employee_name?: string | null;
  assigned_department_name?: string | null;
}

interface AssetRowProps {
  asset: Asset;
  onViewDetails: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
  onAssign?: (asset: Asset) => void;
  onHandover?: (asset: Asset) => void;
  onReturn?: (asset: Asset) => void;
  canManageAssignments?: boolean;
}

export const AssetRow = ({ asset, onViewDetails, onEditAsset, onDeleteAsset, onAssign, onHandover, onReturn, canManageAssignments }: AssetRowProps) => {
  const { t } = useAppTranslation();
  const fromPurchaseRequest = !!asset.purchase_request_id;
  const receiptConfirmed = !!asset.receipt_confirmed_at;
  const receiptStatusLabel = !fromPurchaseRequest ? '-' : receiptConfirmed ? t('companyAssets.receiptStatus.received', 'Received') : t('companyAssets.receiptStatus.pendingReceipt', 'Pending receipt');

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in-use':
        return 'bg-success-muted text-success-foreground';
      case 'available':
        return 'bg-info-muted text-info-foreground';
      case 'maintenance':
        return 'bg-warning-muted text-warning-foreground';
      case 'lost':
        return 'bg-destructive/10 text-destructive';
      case 'retired':
        return 'bg-neutral-muted text-neutral-status';
      case 'other':
      case 'lainnya':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-neutral-muted text-neutral-status';
    }
  };

  const getConditionLabel = (condition: string) =>
    condition === 'other'
      ? 'Lainnya'
      : condition?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown';

  const c = COMPANY_ASSET_TABLE_COLUMN_CLASS;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className={`font-medium text-sm ${c.asset}`}>{asset.name}</TableCell>
      <TableCell className={`capitalize text-sm ${c.type}`}>
        {asset.type === 'other' ? 'Lainnya' : asset.type?.replace('-', ' ')}
      </TableCell>
      <TableCell className={`font-mono text-sm ${c.serialNumber}`}>{asset.serial_number || '-'}</TableCell>
      <TableCell className={`text-sm ${c.brandModel}`}>
        {asset.brand && asset.model ? `${asset.brand} ${asset.model}` : 
         asset.brand || asset.model || '-'}
      </TableCell>
      <TableCell className={c.status}>
        <Badge className={getStatusBadgeColor(asset.status)} variant="secondary">
          {asset.status === 'other' ? 'Lainnya' : 
           asset.status?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
        </Badge>
      </TableCell>
      <TableCell className={`text-sm ${c.heldBy}`}>
        {asset.status === 'in-use' ? (asset.assigned_employee_name ?? '-') : '-'}
      </TableCell>
      <TableCell className={`text-sm ${c.holderDepartment}`}>
        {asset.status === 'in-use' ? (asset.assigned_department_name ?? '-') : '-'}
      </TableCell>
      <TableCell className={`text-sm ${c.condition}`}>
        {getConditionLabel(asset.condition)}
      </TableCell>
      <TableCell className={`text-xs text-muted-foreground ${c.requestedBy}`}>
        {asset.requester_name ?? '-'}
      </TableCell>
      <TableCell className={`text-xs text-muted-foreground ${c.department}`}>
        {asset.department_name ?? '-'}
      </TableCell>
      <TableCell className={c.receipt}>
        {fromPurchaseRequest ? (
          <Badge className={receiptConfirmed ? 'bg-success-muted text-success-foreground' : 'bg-warning-muted text-warning-foreground'} variant="secondary">
            {receiptStatusLabel}
          </Badge>
        ) : (
          <span className="text-muted-foreground/70">-</span>
        )}
      </TableCell>
      <TableCell className={`text-sm ${c.purchasePrice}`}>
        {asset.purchase_price ? `Rp ${asset.purchase_price.toLocaleString('id-ID')}` : '-'}
      </TableCell>
      <TableCell className={`text-sm ${c.purchaseDate}`}>
        {asset.purchase_date ? format(new Date(asset.purchase_date), 'dd/MM/yyyy') : '-'}
      </TableCell>
      <TableCell className={c.actions}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover shadow-lg">
            <DropdownMenuItem onClick={() => onViewDetails(asset)}>
              {t('companyAssets.viewDetails', 'View details')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditAsset(asset)}>
              {t('companyAssets.editAsset', 'Edit asset')}
            </DropdownMenuItem>
            {canManageAssignments && (asset.status !== 'in-use' || !asset.assigned_to_employee_id) && onAssign && (
              <DropdownMenuItem onClick={() => onAssign(asset)}>
                <UserPlus className="h-4 w-4 mr-2" />
                {t('companyAssets.assignAsset', 'Assign / Handover')}
              </DropdownMenuItem>
            )}
            {canManageAssignments && asset.status === 'in-use' && asset.assigned_to_employee_id && onHandover && (
              <DropdownMenuItem onClick={() => onHandover(asset)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {t('companyAssets.handoverAsset', 'Handover')}
              </DropdownMenuItem>
            )}
            {canManageAssignments && asset.status === 'in-use' && onReturn && (
              <DropdownMenuItem onClick={() => onReturn(asset)}>
                <Package className="h-4 w-4 mr-2" />
                {t('companyAssets.returnAsset', 'Return')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onDeleteAsset(asset)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('companyAssets.deleteAsset', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};
