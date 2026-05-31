import { Briefcase, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import {
  InfoFieldRow,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import { useProfileMyWork } from '@/mobile/1-profile/hooks/useProfileMyWork';
import {
  buildIdentityOrgFields,
  buildPositionStructureFields,
  buildStatusTenureFields,
  filterMyWorkFields,
  hasAnyMyWorkDisplayData,
} from '@/mobile/1-profile/utils/myWorkDisplayUtils';

interface MyWorkDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  organizationId: string | null;
  userId: string | null;
  hasEmployeeRecord?: boolean;
}

function renderFieldGroup(
  sectionTitle: string,
  fields: { label: string; value: string | undefined }[],
) {
  const visibleFields = filterMyWorkFields(fields);
  if (visibleFields.length === 0) return null;

  return (
    <InfoSection title={sectionTitle} hasContent={visibleFields.length > 0}>
      {visibleFields.map((field) => (
        <InfoFieldRow key={field.label} label={field.label} value={field.value} />
      ))}
    </InfoSection>
  );
}

export const MyWorkDetailModal = ({
  open,
  onOpenChange,
  employeeId,
  organizationId,
  userId,
  hasEmployeeRecord = false,
}: MyWorkDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const enabled = open && Boolean(employeeId && organizationId);

  const { myWorkInfo, loading } = useProfileMyWork(employeeId, organizationId, userId, enabled);

  const handleClose = () => onOpenChange(false);

  const renderBody = () => {
    if (!hasEmployeeRecord || !employeeId) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.myWork.noEmployee', 'Employee data is not available')}
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

    if (!myWorkInfo || !hasAnyMyWorkDisplayData(myWorkInfo)) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.myWork.empty', 'No work information yet')}
            </p>
          </div>
        </Card>
      );
    }

    const identitySection = renderFieldGroup(
      t('profile.myWork.identitySection', 'Identity & Organization'),
      buildIdentityOrgFields(myWorkInfo, t),
    );
    const positionSection = renderFieldGroup(
      t('profile.myWork.positionSection', 'Position & Structure'),
      buildPositionStructureFields(myWorkInfo, t),
    );
    const statusSection = renderFieldGroup(
      t('profile.myWork.statusSection', 'Status & Tenure'),
      buildStatusTenureFields(myWorkInfo, t, language),
    );

    return (
      <>
        {identitySection}
        {positionSection}
        {statusSection}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t('profile.myWork.title', 'My Work')}
          icon={Briefcase}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={profileFullscreenScrollBodyClass()}>
          <div className="mx-auto w-full max-w-md space-y-3">{renderBody()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
