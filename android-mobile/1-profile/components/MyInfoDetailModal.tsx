import { User } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { ProfileData } from '@/mobile-app/hooks/useProfile';
import {
  formatBirthDate,
  formatGender,
  formatMaritalStatus,
  formatReligion,
  hasDisplayValue,
} from '@/mobile/1-profile/utils/myInfoDisplayUtils';
import {
  InfoFieldRow,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';

interface MyInfoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
}

export const MyInfoDetailModal = ({ open, onOpenChange, profile }: MyInfoDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();

  const birthDateDisplay = formatBirthDate(profile.birth_date, language);
  const genderDisplay = formatGender(profile.gender, t);
  const maritalDisplay = formatMaritalStatus(profile.marital_status, t);
  const religionDisplay = formatReligion(profile.religion, t);

  const personalFields = [
    { label: t('profile.myInfo.fullName', 'Full Name'), value: profile.full_name },
    { label: t('profile.phone', 'Phone'), value: profile.mobile_phone },
    { label: t('profile.email', 'Email'), value: profile.email },
    { label: t('profile.myInfo.birthPlace', 'Birth Place'), value: profile.birth_place },
    { label: t('profile.myInfo.birthDate', 'Birth Date'), value: birthDateDisplay },
    { label: t('profile.myInfo.genderLabel', 'Gender'), value: genderDisplay },
    { label: t('profile.myInfo.maritalStatus', 'Marital Status'), value: maritalDisplay },
    { label: t('profile.myInfo.religionLabel', 'Religion'), value: religionDisplay },
  ];

  const identityFields = [
    { label: t('profile.myInfo.nik', 'NIK'), value: profile.nik },
    { label: t('profile.myInfo.currentAddress', 'Current Address'), value: profile.address },
    { label: t('profile.myInfo.citizenAddress', 'Citizen Address'), value: profile.citizen_address },
  ];

  const hasPersonalContent = personalFields.some((field) => hasDisplayValue(field.value));
  const hasIdentityContent = identityFields.some((field) => hasDisplayValue(field.value));

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t('profile.myInfo.title', 'My Info')}
          icon={User}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={profileFullscreenScrollBodyClass()}>
          <div className="mx-auto w-full max-w-md space-y-3">
            <InfoSection
              title={t('profile.myInfo.personalData', 'Personal Data')}
              hasContent={hasPersonalContent}
            >
              {personalFields.map((field) => (
                <InfoFieldRow key={field.label} label={field.label} value={field.value} />
              ))}
            </InfoSection>

            <InfoSection
              title={t('profile.myInfo.identityAddress', 'Identity & Address')}
              hasContent={hasIdentityContent}
            >
              {identityFields.map((field) => (
                <InfoFieldRow key={field.label} label={field.label} value={field.value} />
              ))}
            </InfoSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
