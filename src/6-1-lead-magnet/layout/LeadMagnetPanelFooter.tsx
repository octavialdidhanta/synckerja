import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  count?: number;
  sectionLabel?: string;
};

export function LeadMagnetPanelFooter({ count = 0, sectionLabel }: Props) {
  const { t } = useAppTranslation();
  const resolvedSection = sectionLabel ?? t('leadMagnet.tabs.campaigns', 'Campaign');

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('leadMagnet.footer.showing', 'Showing {{count}} {{section}}', {
            count,
            section: resolvedSection,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('leadMagnet.footer.total', 'Total: {{count}}', { count })}
        </span>
      </div>
    </div>
  );
}
