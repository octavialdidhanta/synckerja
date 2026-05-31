import { GraduationCap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { Badge } from '@/mobile-app/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';
import { formatSingleDate } from '@/mobile/1-profile/utils/educationExperienceDisplayUtils';
import {
  InfoFieldRow,
  InfoGroupHeading,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import {
  useProfileEducationExperience,
  type FormalEducationData,
  type InformalEducationData,
  type WorkExperienceData,
} from '@/mobile/1-profile/hooks/useProfileEducationExperience';

interface EducationExperienceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  hasEmployeeRecord?: boolean;
}

function CurrentBadge({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="text-xs shrink-0">
      {label}
    </Badge>
  );
}

function buildFormalEducationFields(
  item: FormalEducationData,
  t: ReturnType<typeof useAppTranslation>['t'],
  language: ReturnType<typeof useLanguage>['language'],
) {
  const endDateValue = item.is_current
    ? t('profile.educationExperience.currentBadge', 'Current')
    : formatSingleDate(item.end_date, language);

  return [
    { label: t('profile.educationExperience.degreeLabel', 'Degree'), value: item.degree },
    {
      label: t('profile.educationExperience.fieldOfStudyLabel', 'Field of Study'),
      value: item.field_of_study,
    },
    {
      label: t('profile.educationExperience.startDateLabel', 'Start Date'),
      value: formatSingleDate(item.start_date, language),
    },
    { label: t('profile.educationExperience.endDateLabel', 'End Date'), value: endDateValue },
    { label: t('profile.educationExperience.gradeGpaLabel', 'GPA/Grade'), value: item.grade_gpa },
    { label: t('profile.educationExperience.descriptionLabel', 'Description'), value: item.description },
  ];
}

function buildInformalEducationFields(
  item: InformalEducationData,
  t: ReturnType<typeof useAppTranslation>['t'],
  language: ReturnType<typeof useLanguage>['language'],
) {
  return [
    { label: t('profile.educationExperience.providerLabel', 'Provider'), value: item.provider },
    {
      label: t('profile.educationExperience.certFieldLabel', 'Certification Field'),
      value: item.field_of_certification,
    },
    {
      label: t('profile.educationExperience.certNumberLabel', 'Certificate Number'),
      value: item.certificate_number,
    },
    {
      label: t('profile.educationExperience.startDateLabel', 'Start Date'),
      value: formatSingleDate(item.start_date, language),
    },
    {
      label: t('profile.educationExperience.endDateLabel', 'End Date'),
      value: formatSingleDate(item.end_date, language),
    },
    { label: t('profile.educationExperience.descriptionLabel', 'Description'), value: item.description },
  ];
}

function buildWorkExperienceFields(
  item: WorkExperienceData,
  t: ReturnType<typeof useAppTranslation>['t'],
  language: ReturnType<typeof useLanguage>['language'],
) {
  const endDateValue = item.is_current
    ? t('profile.educationExperience.currentBadge', 'Current')
    : formatSingleDate(item.end_date, language);

  return [
    { label: t('profile.educationExperience.positionLabel', 'Position'), value: item.position },
    { label: t('profile.educationExperience.locationLabel', 'Location'), value: item.location },
    {
      label: t('profile.educationExperience.startDateLabel', 'Start Date'),
      value: formatSingleDate(item.start_date, language),
    },
    { label: t('profile.educationExperience.endDateLabel', 'End Date'), value: endDateValue },
    {
      label: t('profile.educationExperience.jobDescriptionLabel', 'Job Description'),
      value: item.job_description,
    },
  ];
}

function filterFields(fields: { label: string; value: string | undefined }[]) {
  return fields.filter((field) => hasDisplayValue(field.value));
}

export const EducationExperienceDetailModal = ({
  open,
  onOpenChange,
  employeeId,
  hasEmployeeRecord = false,
}: EducationExperienceDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const enabled = open && Boolean(employeeId);

  const { formalEducations, informalEducations, workExperiences, loading } =
    useProfileEducationExperience(employeeId, enabled);

  const handleClose = () => onOpenChange(false);

  const currentBadgeLabel = t('profile.educationExperience.currentBadge', 'Current');
  const hasAnyData =
    formalEducations.length > 0 || informalEducations.length > 0 || workExperiences.length > 0;

  const renderBody = () => {
    if (!hasEmployeeRecord || !employeeId) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.educationExperience.noEmployee', 'Employee data is not available')}
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

    if (!hasAnyData) {
      return (
        <Card className="bg-gradient-card border border-border">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.educationExperience.empty', 'No education or experience data yet')}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <>
        {formalEducations.length > 0 && (
          <div className="space-y-2">
            <InfoGroupHeading
              title={t('profile.educationExperience.formalSection', 'Formal Education')}
            />
            {formalEducations.map((item, index) => {
              const fields = filterFields(buildFormalEducationFields(item, t, language));
              const title =
                item.institution_name?.trim() ||
                t('profile.educationExperience.formalItem', 'Education {{index}}', { index: index + 1 });

              return (
                <InfoSection
                  key={item.id}
                  title={title}
                  hasContent={fields.length > 0}
                  titleExtra={
                    item.is_current ? <CurrentBadge label={currentBadgeLabel} /> : undefined
                  }
                >
                  {fields.map((field) => (
                    <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                  ))}
                </InfoSection>
              );
            })}
          </div>
        )}

        {informalEducations.length > 0 && (
          <div className="space-y-2">
            <InfoGroupHeading
              title={t('profile.educationExperience.informalSection', 'Informal Education')}
            />
            {informalEducations.map((item, index) => {
              const fields = filterFields(buildInformalEducationFields(item, t, language));
              const title =
                item.course_name?.trim() ||
                t('profile.educationExperience.informalItem', 'Training {{index}}', { index: index + 1 });

              return (
                <InfoSection key={item.id} title={title} hasContent={fields.length > 0}>
                  {fields.map((field) => (
                    <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                  ))}
                </InfoSection>
              );
            })}
          </div>
        )}

        {workExperiences.length > 0 && (
          <div className="space-y-2">
            <InfoGroupHeading
              title={t('profile.educationExperience.workSection', 'Work Experience')}
            />
            {workExperiences.map((item, index) => {
              const fields = filterFields(buildWorkExperienceFields(item, t, language));
              const title =
                item.company_name?.trim() ||
                t('profile.educationExperience.workItem', 'Experience {{index}}', { index: index + 1 });

              return (
                <InfoSection
                  key={item.id}
                  title={title}
                  hasContent={fields.length > 0}
                  titleExtra={
                    item.is_current ? <CurrentBadge label={currentBadgeLabel} /> : undefined
                  }
                >
                  {fields.map((field) => (
                    <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                  ))}
                </InfoSection>
              );
            })}
          </div>
        )}
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
          title={t('profile.educationExperience.title', 'Education & Experience')}
          icon={GraduationCap}
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
