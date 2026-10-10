import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface FeatureTooltipSource {
  feature_description?: string | null;
  solution?: string | null;
  competitive_advantage?: unknown;
}

function featurePlainText(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map((item) => featurePlainText(item)).filter(Boolean).join('\n');
  }
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function featureHasTooltipDetail(feature: FeatureTooltipSource): boolean {
  return Boolean(
    featurePlainText(feature.feature_description)
    || featurePlainText(feature.solution)
    || featurePlainText(feature.competitive_advantage),
  );
}

export function FeatureDetailTooltipBody({ feature }: { feature: FeatureTooltipSource }) {
  const { t } = useAppTranslation();
  const sections = [
    [t('socialMedia.featureTooltip.description', 'Description'), featurePlainText(feature.feature_description)],
    [t('socialMedia.featureTooltip.solution', 'Solution'), featurePlainText(feature.solution)],
    [t('socialMedia.featureTooltip.competitiveAdvantage', 'Competitive Advantage'), featurePlainText(feature.competitive_advantage)],
  ].filter(([, text]) => text);

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto text-left">
      {sections.map(([label, text]) => (
        <div key={label}>
          <p className="text-[10px] font-semibold text-slate-500">{label}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-4 text-slate-800">{text}</p>
        </div>
      ))}
    </div>
  );
}

export const featureTooltipClassName = 'z-[80] w-80 max-w-[20rem] border-slate-200 bg-white p-2.5 text-left shadow-lg';
