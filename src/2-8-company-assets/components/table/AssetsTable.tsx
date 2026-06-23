import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
} from '@/shared/components/ui/table';
import { ViewAssetModal } from '../modals/ViewAssetModal';
import { EditAssetModal } from '../modals/EditAssetModal';
import { AssignAssetModal } from '../modals/AssignAssetModal';
import { HandoverAssetModal } from '../modals/HandoverAssetModal';
import { ReturnAssetModal } from '../modals/ReturnAssetModal';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { AssetRow } from './assets-table/AssetRow';
import { AssetsTableHeader } from './assets-table/AssetsTableHeader';
import { AssetsEmptyState } from './assets-table/AssetsEmptyState';
import { DeleteAssetDialog } from './assets-table/DeleteAssetDialog';
import { useAssetFilters } from './assets-table/useAssetFilters';
import { CompanyAssetsTableFooter } from './assets-table/CompanyAssetsTableFooter';
import { COMPANY_ASSET_TABLE_MIN_WIDTH } from './assets-table/companyAssetTableColumns';

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

interface AssetsTableProps {
  assets: Asset[];
  searchTerm: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedCondition: string;
  selectedReceiptFilter?: string;
  isLoading?: boolean;
  onRefresh: () => void;
}

export const AssetsTable = ({ 
  assets, 
  searchTerm, 
  selectedCategory, 
  selectedStatus, 
  selectedCondition,
  selectedReceiptFilter = 'all',
  isLoading = false,
  onRefresh
}: AssetsTableProps) => {
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useAppTranslation();
  const showToast = useShowToast();
  const { data: userRole } = useCurrentUserRole();
  const canManageAssignments = !!userRole && ['admin', 'hr', 'owner'].includes(userRole);

  const { filteredAssets } = useAssetFilters({
    assets,
    searchTerm,
    selectedCategory,
    selectedStatus,
    selectedCondition,
    selectedReceiptFilter,
  });

  const handleViewDetails = useCallback((asset: Asset) => {
    console.log('Opening view modal for asset:', asset.id);
    setSelectedAsset(asset);
    setViewModalOpen(true);
  }, []);

  const handleEditAsset = useCallback((asset: Asset) => {
    console.log('Opening edit modal for asset:', asset.id);
    setSelectedAsset(asset);
    setEditModalOpen(true);
  }, []);

  const handleDeleteAsset = useCallback((asset: Asset) => {
    console.log('Opening delete dialog for asset:', asset.id);
    setSelectedAsset(asset);
    setDeleteDialogOpen(true);
  }, []);

  const handleAssign = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setAssignModalOpen(true);
  }, []);

  const handleHandover = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setHandoverModalOpen(true);
  }, []);

  const handleReturn = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setReturnModalOpen(true);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    console.log('Closing view modal');
    setViewModalOpen(false);
    setSelectedAsset(null);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    console.log('Closing edit modal');
    setEditModalOpen(false);
    setSelectedAsset(null);
  }, []);

  const confirmDeleteAsset = async () => {
    if (!selectedAsset) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('company_assets')
        .delete()
        .eq('id', selectedAsset.id);

      if (error) {
        throw error;
      }

      showToast({
        title: t('common.success', 'Success'),
        description: t('companyAssets.deleteSuccess', 'Asset deleted successfully.'),
        variant: 'default'
      });

      onRefresh();
      setDeleteDialogOpen(false);
      setSelectedAsset(null);

    } catch (error: any) {
      showToast({
        title: t('common.error', 'Error'),
        description: error.message || t('companyAssets.deleteFailed', 'Failed to delete asset'),
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasAssets = filteredAssets.length > 0;

  if (isLoading || !hasAssets) {
    return <AssetsEmptyState isLoading={isLoading} hasAssets={hasAssets} />;
  }

  // Calculate total asset value
  const totalValue = filteredAssets.reduce((acc, asset) => acc + (asset.purchase_price || 0), 0);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Table
          className={`${COMPANY_ASSET_TABLE_MIN_WIDTH} w-full caption-bottom text-sm`}
          containerClassName="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <AssetsTableHeader />
          <TableBody>
            {filteredAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                onViewDetails={handleViewDetails}
                onEditAsset={handleEditAsset}
                onDeleteAsset={handleDeleteAsset}
                onAssign={handleAssign}
                onHandover={handleHandover}
                onReturn={handleReturn}
                canManageAssignments={canManageAssignments}
              />
            ))}
          </TableBody>
        </Table>
        
        {/* Fixed Footer */}
        <CompanyAssetsTableFooter
          totalAssets={assets.length}
          filteredAssets={filteredAssets.length}
          totalValue={totalValue}
        />
      </div>

      <ViewAssetModal
        isOpen={viewModalOpen}
        onClose={handleCloseViewModal}
        asset={selectedAsset}
        onRefresh={onRefresh}
      />

      <EditAssetModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        onSave={() => {
          onRefresh();
          handleCloseEditModal();
        }}
        asset={selectedAsset}
      />

      <DeleteAssetDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteAsset}
        isDeleting={isDeleting}
        asset={selectedAsset}
      />

      <AssignAssetModal
        isOpen={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setSelectedAsset(null); }}
        asset={selectedAsset}
        onSuccess={onRefresh}
      />
      <HandoverAssetModal
        isOpen={handoverModalOpen}
        onClose={() => { setHandoverModalOpen(false); setSelectedAsset(null); }}
        asset={selectedAsset}
        onSuccess={onRefresh}
      />
      <ReturnAssetModal
        isOpen={returnModalOpen}
        onClose={() => { setReturnModalOpen(false); setSelectedAsset(null); }}
        asset={selectedAsset}
        onSuccess={onRefresh}
      />
    </>
  );
};
