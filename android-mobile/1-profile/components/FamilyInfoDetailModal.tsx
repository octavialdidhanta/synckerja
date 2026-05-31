import { Users } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { Badge } from '@/mobile-app/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { FamilyMemberData } from '@/mobile-app/hooks/useProfile';
import { formatGender, hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';
import { formatAge, formatRelationship } from '@/mobile/1-profile/utils/familyMemberDisplayUtils';
import {
  InfoFieldRow,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';

interface FamilyInfoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMemberData[];
}

function buildMemberFields(
  member: FamilyMemberData,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  return [
    { label: t('profile.familyInfo.name', 'Name'), value: member.name },
    {
      label: t('profile.familyInfo.relationshipLabel', 'Relationship'),
      value: formatRelationship(member.relationship, t),
    },
    {
      label: t('profile.familyInfo.genderLabel', 'Gender'),
      value: formatGender(member.gender, t),
    },
    { label: t('profile.familyInfo.age', 'Age'), value: formatAge(member.age) },
    { label: t('profile.familyInfo.occupation', 'Occupation'), value: member.occupation },
    { label: t('profile.familyInfo.phone', 'Phone'), value: member.phone },
    { label: t('profile.familyInfo.address', 'Address'), value: member.address },
  ];
}

export const FamilyInfoDetailModal = ({
  open,
  onOpenChange,
  members,
}: FamilyInfoDetailModalProps) => {
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
          title={t('profile.familyInfo.title', 'Family Info')}
          icon={Users}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={profileFullscreenScrollBodyClass()}>
          <div className="mx-auto w-full max-w-md space-y-3">
            {members.length === 0 ? (
              <Card className="bg-gradient-card border border-border">
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('profile.familyInfo.empty', 'No family members registered yet')}
                  </p>
                </div>
              </Card>
            ) : (
              members.map((member, index) => {
                const fields = buildMemberFields(member, t);
                const hasContent = fields.some((field) => hasDisplayValue(field.value));

                return (
                  <InfoSection
                    key={member.id}
                    title={t('profile.familyInfo.memberNumber', 'Member {{index}}', {
                      index: index + 1,
                    })}
                    hasContent={hasContent}
                    titleExtra={
                      member.is_emergency_contact ? (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          {t('profile.familyInfo.emergencyBadge', 'Emergency Contact')}
                        </Badge>
                      ) : undefined
                    }
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
