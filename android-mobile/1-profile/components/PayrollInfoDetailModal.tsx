import { DollarSign, Loader2 } from 'lucide-react';
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
import { useProfilePayrollInfo } from '@/mobile/1-profile/hooks/useProfilePayrollInfo';
import {
  buildBankingFields,
  buildBpjsFields,
  buildTaxFields,
  filterPayrollFields,
  hasAnyPayrollDisplayData,
} from '@/mobile/1-profile/utils/payrollInfoDisplayUtils';

interface PayrollInfoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  hasEmployeeRecord?: boolean;
}

function renderFieldGroup(
  sectionTitle: string,
  fields: { label: string; value: string | undefined }[],
) {
  const visibleFields = filterPayrollFields(fields);
  if (visibleFields.length === 0) return null;

  return (
    <InfoSection title={sectionTitle} hasContent={visibleFields.length > 0}>
      {visibleFields.map((field) => (
        <InfoFieldRow key={field.label} label={field.label} value={field.value} />
      ))}
    </InfoSection>
  );
}

export const PayrollInfoDetailModal = ({
  open,
  onOpenChange,
  employeeId,
  hasEmployeeRecord = false,
}: PayrollInfoDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const enabled = open && Boolean(employeeId);

  const { payrollInfo, loading } = useProfilePayrollInfo(employeeId, enabled);

  const handleClose = () => onOpenChange(false);

  const renderBody = () => {
    if (!hasEmployeeRecord || !employeeId) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.payrollInfo.noEmployee', 'Employee data is not available')}
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

    if (!payrollInfo || !hasAnyPayrollDisplayData(payrollInfo)) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.payrollInfo.empty', 'No payroll information yet')}
            </p>
          </div>
        </Card>
      );
    }

    const bpjsSection = renderFieldGroup(
      t('profile.payrollInfo.bpjsSection', 'BPJS Information'),
      buildBpjsFields(payrollInfo, t, language),
    );
    const bankingSection = renderFieldGroup(
      t('profile.payrollInfo.bankingSection', 'Bank & NPWP'),
      buildBankingFields(payrollInfo, t),
    );
    const taxSection = renderFieldGroup(
      t('profile.payrollInfo.taxSection', 'Tax Information'),
      buildTaxFields(payrollInfo, t, language),
    );

    return (
      <>
        {bpjsSection}
        {bankingSection}
        {taxSection}
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
          title={t('profile.payrollInfo.title', 'Payroll Information')}
          icon={DollarSign}
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
