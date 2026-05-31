import { Phone } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { EmergencyContactData } from '@/mobile-app/hooks/useProfile';
import { formatGender, hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';
import { formatAge, formatRelationship } from '@/mobile/1-profile/utils/emergencyContactDisplayUtils';
import {
  InfoFieldRow,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';

interface EmergencyContactDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: EmergencyContactData[];
}

function buildContactFields(
  contact: EmergencyContactData,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  return [
    { label: t('profile.emergencyContact.name', 'Name'), value: contact.name },
    {
      label: t('profile.emergencyContact.relationshipLabel', 'Relationship'),
      value: formatRelationship(contact.relationship, t),
    },
    {
      label: t('profile.emergencyContact.genderLabel', 'Gender'),
      value: formatGender(contact.gender, t),
    },
    { label: t('profile.emergencyContact.age', 'Age'), value: formatAge(contact.age) },
    { label: t('profile.emergencyContact.occupation', 'Occupation'), value: contact.occupation },
    { label: t('profile.emergencyContact.phone', 'Phone'), value: contact.phone },
    { label: t('profile.emergencyContact.address', 'Address'), value: contact.address },
  ];
}

export const EmergencyContactDetailModal = ({
  open,
  onOpenChange,
  contacts,
}: EmergencyContactDetailModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();

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
          title={t('profile.emergencyContact.title', 'Emergency Contact Info')}
          icon={Phone}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={profileFullscreenScrollBodyClass()}>
          <div className="mx-auto w-full max-w-md space-y-3">
            {contacts.length === 0 ? (
              <Card className="bg-gradient-card border border-border">
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('profile.emergencyContact.empty', 'No emergency contact registered yet')}
                  </p>
                </div>
              </Card>
            ) : (
              contacts.map((contact, index) => {
                const fields = buildContactFields(contact, t);
                const hasContent = fields.some((field) => hasDisplayValue(field.value));

                return (
                  <InfoSection
                    key={contact.id}
                    title={t('profile.emergencyContact.contactNumber', 'Contact {{index}}', {
                      index: index + 1,
                    })}
                    hasContent={hasContent}
                  >
                    {fields.map((field) => (
                      <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                    ))}
                  </InfoSection>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
