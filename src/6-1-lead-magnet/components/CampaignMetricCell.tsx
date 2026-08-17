import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  formatLeadMagnetMetricValue,
  type LeadMagnetMetricFormat,
} from '../lib/formatLeadMagnetMetricValue';

type Props = {
  value: number;
  tooltipKey: string;
  format?: LeadMagnetMetricFormat;
};

export function CampaignMetricCell({ value, tooltipKey, format = 'count' }: Props) {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help whitespace-nowrap font-semibold tabular-nums">
            {formatLeadMagnetMetricValue(value, format)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>{t(tooltipKey)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
