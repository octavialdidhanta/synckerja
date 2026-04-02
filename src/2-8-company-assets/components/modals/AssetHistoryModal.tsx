import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAssetAssignments, AssetAssignmentRow, HandoverType } from '@/2-8-company-assets/hooks/useAssetAssignments';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { format } from 'date-fns';
import { History, Download, FileText, User, Building2 } from 'lucide-react';

const BUCKET = 'employee-documents';

const handoverTypeLabel = (t: (key: string, fallback: string) => string, type: HandoverType): string => {
  switch (type) {
    case 'initial_assignment': return t('companyAssets.handoverTypeInitial', 'Initial assignment');
    case 'transfer': return t('companyAssets.handoverTypeTransfer', 'Transfer');
    case 'resignation': return t('companyAssets.handoverTypeResignation', 'Resignation');
    case 'return': return t('companyAssets.handoverTypeReturn', 'Return');
    default: return type;
  }
};

interface AssetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
  assetName: string;
}

export const AssetHistoryModal = ({ isOpen, onClose, assetId, assetName }: AssetHistoryModalProps) => {
  const { t } = useAppTranslation();
  const { data: userRole } = useCurrentUserRole();
  const showToast = useShowToast();
  const { assignments, isLoading } = useAssetAssignments(assetId);
  const isHr = String(userRole ?? '') === 'hr';

  const handleDownload = async (documentPath: string | null) => {
    if (!isHr || !documentPath) return;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(documentPath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      showToast({ title: t('common.error', 'Error'), description: err?.message ?? t('common.failed', 'Failed'), variant: 'destructive' });
    }
  };

  if (!assetId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('companyAssets.assignmentHistory', 'Riwayat serah terima')} — {assetName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto rounded-md border border-border p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('companyAssets.loading', 'Loading...')}</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('companyAssets.noHistoryYet', 'No history yet.')}</p>
          ) : (
            <ul className="space-y-4">
              {assignments.map((row: AssetAssignmentRow) => (
                <li key={row.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{handoverTypeLabel(t, row.handover_type)}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(row.assigned_at), 'dd MMM yyyy HH:mm')}
                          {row.ended_at && ` — ${format(new Date(row.ended_at), 'dd MMM yyyy')}`}
                        </span>
                      </div>
                      {row.employee_id != null && (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span>{row.employee_full_name ?? '-'}</span>
                          {row.employee_department_name && (
                            <>
                              <Building2 className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span>{row.employee_department_name}</span>
                            </>
                          )}
                        </div>
                      )}
                      {row.handover_type === 'return' && (
                        <div className="text-sm text-muted-foreground">{t('companyAssets.returnedToCompany', 'Returned to company')}</div>
                      )}
                      {row.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{row.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {isHr ? (
                        row.document_path ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(row.document_path)}
                            className="text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {t('companyAssets.downloadDocument', 'Unduh dokumen')}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('companyAssets.noDocument', '—')}</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('companyAssets.documentHrOnly', 'Document (HR only)')}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
