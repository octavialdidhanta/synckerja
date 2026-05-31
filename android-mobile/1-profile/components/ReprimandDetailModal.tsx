import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import { useProfileReprimands } from '@/mobile/1-profile/hooks/useProfileReprimands';
import type { ProfileReprimandRecord } from '@/mobile/1-profile/hooks/useProfileReprimands';
import { ReprimandList } from '@/mobile/1-profile/components/ReprimandList';
import { ReprimandPreviewDetailModal } from '@/mobile/1-profile/components/ReprimandPreviewDetailModal';
import { useState } from 'react';

interface ReprimandDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  organizationId: string | null;
  hasEmployeeRecord?: boolean;
}

export const ReprimandDetailModal = ({
  open,
  onOpenChange,
  employeeId,
  organizationId,
  hasEmployeeRecord = false,
}: ReprimandDetailModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const enabled = open && Boolean(employeeId && organizationId);

  const { reprimands, loading } = useProfileReprimands(employeeId, organizationId, enabled);
  const [selectedReprimand, setSelectedReprimand] = useState<ProfileReprimandRecord | null>(null);

  const handleClose = () => onOpenChange(false);

  const renderBody = () => {
    if (!hasEmployeeRecord || !employeeId) {
      return (
        <Card className="border border-border bg-gradient-card">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.reprimand.noEmployee', 'Employee data is not available')}
            </p>
          </div>
        </Card>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      );
    }

    if (reprimands.length === 0) {
      return (
        <Card className="border border-border bg-gradient-card">
          <div className="space-y-2 p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {t('profile.reprimand.empty', 'No reprimands on record')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                'profile.reprimand.emptyDesc',
                'You have a clean record with no disciplinary actions.',
              )}
            </p>
          </div>
        </Card>
      );
    }

    return <ReprimandList reprimands={reprimands} onSelect={setSelectedReprimand} />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={profileFullscreenDialogContentClass(isMobile)}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          <ProfileDetailModalHeader
            isMobile={isMobile}
            title={t('profile.reprimand.title', 'Reprimand')}
            icon={AlertTriangle}
            closeLabel={t('layout.sheetClose', 'Close')}
            onClose={handleClose}
          />

          <div className={profileFullscreenScrollBodyClass()}>
            <div className="mx-auto w-full max-w-md space-y-3">{renderBody()}</div>
          </div>
        </DialogContent>
      </Dialog>

      <ReprimandPreviewDetailModal
        reprimand={selectedReprimand}
        open={Boolean(selectedReprimand)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedReprimand(null);
        }}
      />
    </>
  );
};
