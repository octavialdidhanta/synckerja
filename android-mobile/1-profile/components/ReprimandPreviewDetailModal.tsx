import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Button } from '@/mobile-app/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
import type { ProfileReprimandRecord } from '@/mobile/1-profile/hooks/useProfileReprimands';
import {
  buildReprimandCoreFields,
  filterReprimandFields,
  formatIncidentDate,
  formatReprimandType,
  getReprimandListSummary,
  getSeverityBadgeClass,
  getStatusBadgeClass,
} from '@/mobile/1-profile/utils/reprimandDisplayUtils';

interface ReprimandPreviewDetailModalProps {
  reprimand: ProfileReprimandRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReprimandPreviewDetailModal = ({
  reprimand,
  open,
  onOpenChange,
}: ReprimandPreviewDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();

  const handleClose = () => onOpenChange(false);

  if (!reprimand) return null;

  const summary = getReprimandListSummary(reprimand, t);
  const typeLabel = formatReprimandType(reprimand.reprimand_type, t) ?? reprimand.reprimand_type;
  const incidentDate = formatIncidentDate(reprimand.incident_date, language);
  const visibleFields = filterReprimandFields(buildReprimandCoreFields(reprimand, t, language));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t('profile.reprimand.detailTitle', 'Reprimand Details')}
          icon={AlertTriangle}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={profileFullscreenScrollBodyClass()}>
          <div className="mx-auto w-full max-w-md space-y-3 pb-2">
            <Card className="overflow-hidden border border-border bg-gradient-card">
              <div className="border-b border-border px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
                    {typeLabel}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${getSeverityBadgeClass(reprimand.severity_level)}`}
                  >
                    {summary.severityLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${getStatusBadgeClass(reprimand.status)}`}
                  >
                    {summary.statusLabel}
                  </Badge>
                </div>
                {incidentDate && (
                  <p className="mt-1 text-xs text-muted-foreground">{incidentDate}</p>
                )}
              </div>
              <div className="px-3 py-3">
                <p className="text-sm text-foreground break-words">{reprimand.violation_description}</p>
              </div>
            </Card>

            {visibleFields.length > 0 && (
              <InfoSection
                title={t('profile.reprimand.detailSection', 'Reprimand Details')}
                hasContent={visibleFields.length > 0}
              >
                {visibleFields.map((field) => (
                  <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                ))}
              </InfoSection>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 safe-area-bottom-lower backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md">
            <Button type="button" variant="outline" className="w-full" onClick={handleClose}>
              {t('layout.sheetClose', 'Close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
