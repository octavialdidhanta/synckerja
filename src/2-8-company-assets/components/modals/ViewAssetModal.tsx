import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { X, Package, User, Building2, CheckCircle, History, Download } from 'lucide-react';
import { AssetImage } from '@/2-8-company-assets/components/details/asset-details/AssetImage';
import { AssetBasicInfo } from '@/2-8-company-assets/components/details/asset-details/AssetBasicInfo';
import { AssetIdentifiers } from '@/2-8-company-assets/components/details/asset-details/AssetIdentifiers';
import { AssetStatusCondition } from '@/2-8-company-assets/components/details/asset-details/AssetStatusCondition';
import { AssetPurchaseInfo } from '@/2-8-company-assets/components/details/asset-details/AssetPurchaseInfo';
import { AssetNotes } from '@/2-8-company-assets/components/details/asset-details/AssetNotes';
import { AssetCreatedDate } from '@/2-8-company-assets/components/details/asset-details/AssetCreatedDate';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAssetAssignments } from '@/2-8-company-assets/hooks/useAssetAssignments';
import { AssetHistoryModal } from './AssetHistoryModal';
import { format } from 'date-fns';

const BUCKET = 'employee-documents';

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  asset_tag: string;
  brand: string;
  model: string;
  condition: string;
  status: string;
  purchase_price: number;
  purchase_date: string;
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

interface ViewAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onRefresh?: () => void;
}

export const ViewAssetModal = ({ isOpen, onClose, asset, onRefresh }: ViewAssetModalProps) => {
  const { t } = useAppTranslation();
  const { user } = useCurrentUser();
  const { data: userRole } = useCurrentUserRole();
  const showToast = useShowToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { assignments } = useAssetAssignments(asset?.id ?? null);
  const currentAssignment = assignments.find((a) => !a.ended_at);
  const isHr = userRole === 'hr';

  const handleDownloadCurrentDoc = async () => {
    if (!isHr || !currentAssignment?.document_path) return;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(currentAssignment.document_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      showToast({ title: t('common.error', 'Error'), description: err?.message ?? t('common.failed', 'Failed'), variant: 'destructive' });
    }
  };

  const fromPurchaseRequest = !!asset?.purchase_request_id;
  const receiptConfirmed = !!asset?.receipt_confirmed_at;
  const isAdmin = userRole === 'admin';
  const canConfirmReceived = fromPurchaseRequest && !receiptConfirmed && isAdmin;

  const handleConfirmReceived = async () => {
    if (!asset?.id || !user) return;
    setIsConfirming(true);
    try {
      const { error } = await supabase
        .from('company_assets')
        .update({
          receipt_confirmed_at: new Date().toISOString(),
          receipt_confirmed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      if (error) throw error;
      showToast({
        title: t('companyAssets.confirmReceivedSuccess', 'Item has been confirmed as received.'),
        description: '',
        variant: 'default',
      });
      onRefresh?.();
      onClose();
    } catch (err: any) {
      showToast({
        title: t('common.error', 'Error'),
        description: err?.message ?? t('companyAssets.editAssetFailed', 'Failed to update asset'),
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[600px] max-h-[90vh] w-[600px] max-w-[90vw] flex-col bg-card p-0" hideCloseButton>
        <DialogHeader className="border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-semibold">{t('companyAssets.assetDetails', 'Asset details')}</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-auto p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div 
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6" 
          style={{
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            scrollbarColor: 'hsl(var(--border)) transparent',
          }}
        >
          {/* Image Section */}
          {asset.image_url && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <AssetImage imageUrl={asset.image_url} assetName={asset.name} />
            </div>
          )}
          
          {/* Basic Information Section */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.basicInformation', 'Basic information')}</h3>
            <AssetBasicInfo 
              name={asset.name}
              type={asset.type}
              brand={asset.brand}
              model={asset.model}
            />
          </div>
          
          {/* Identifiers Section */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.identification', 'Identification')}</h3>
            <AssetIdentifiers 
              serialNumber={asset.serial_number}
              assetTag={asset.asset_tag}
            />
          </div>
          
          {/* Status & Condition Section */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.statusAndCondition', 'Status & condition')}</h3>
            <AssetStatusCondition 
              status={asset.status}
              condition={asset.condition}
            />
          </div>

          {/* Current assignment (when In Use) */}
          {asset.status === 'in-use' && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.currentAssignment', 'Current custodian')}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{t('companyAssets.assignedTo', 'Held by')}</p>
                    <p className="font-medium text-foreground">{asset.assigned_employee_name ?? '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{t('companyAssets.assignedDepartment', "Holder's department")}</p>
                    <p className="font-medium text-foreground">{asset.assigned_department_name ?? '-'}</p>
                  </div>
                </div>
                {asset.assigned_at && (
                  <div className="text-xs text-muted-foreground">
                    {t('companyAssets.assignedSince', 'Since')}: {format(new Date(asset.assigned_at), 'dd MMM yyyy')}
                  </div>
                )}
              </div>
              {currentAssignment?.document_path && (
                <div className="mt-3 pt-3 border-t">
                  {isHr ? (
                    <Button variant="outline" size="sm" onClick={handleDownloadCurrentDoc}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('companyAssets.downloadDocument', 'Download document')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('companyAssets.documentHrOnly', 'Document (HR only)')}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assignment history (all assets) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.assignmentHistory', 'Handover history')}</h3>
            <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-2" />
              {t('companyAssets.viewHistory', 'View history')}
            </Button>
          </div>

          {/* Purchase Information Section */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.purchaseHistory', 'Purchase History')}</h3>
            <AssetPurchaseInfo 
              purchasePrice={asset.purchase_price}
              purchaseDate={asset.purchase_date}
            />
          </div>

          {/* Purchase History (from purchase request flow) */}
          {fromPurchaseRequest && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.purchaseHistory', 'Purchase History')}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{t('companyAssets.requestedBy', 'Requested by')}</p>
                    <p className="font-medium text-foreground">{asset.requester_name ?? '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{t('companyAssets.department', 'Department')}</p>
                    <p className="font-medium text-foreground">{asset.department_name ?? '-'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <span className="mr-2 text-xs text-muted-foreground">{t('companyAssets.receiptLabel', 'Receipt')}:</span>
                <Badge className={receiptConfirmed ? 'bg-success-muted text-success-foreground' : 'bg-warning-muted text-warning-foreground'} variant="secondary">
                  {receiptConfirmed ? t('companyAssets.receiptStatus.received', 'Received') : t('companyAssets.receiptStatus.pendingReceipt', 'Pending receipt')}
                </Badge>
              </div>
              {canConfirmReceived && (
                <Button
                  type="button"
                  onClick={handleConfirmReceived}
                  disabled={isConfirming}
                  className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isConfirming ? (
                    t('common.loading', 'Loading...')
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('companyAssets.confirmReceived', 'Confirm received')}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
          
          {/* Notes Section */}
          {asset.notes && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4 border-b pb-2 text-sm font-semibold text-foreground">{t('companyAssets.additionalNotes', 'Additional notes')}</h3>
              <AssetNotes notes={asset.notes} />
            </div>
          )}
          
          {/* Created Date Section */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <AssetCreatedDate createdAt={asset.created_at} />
          </div>
        </div>
      </DialogContent>
      <AssetHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        assetId={asset.id}
        assetName={asset.name}
      />
    </Dialog>
  );
};
