import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  count?: number;
};

export function ScriptGeneratorPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const sectionLabel = t('productKnowledge.tabs.scriptGenerator', 'Customer Persona');

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('scriptGenerator.footer.showing', 'Showing {{count}} {{section}}', {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('scriptGenerator.footer.total', 'Total: {{count}}', { count })}
        </span>
      </div>
    </div>
  );
}
