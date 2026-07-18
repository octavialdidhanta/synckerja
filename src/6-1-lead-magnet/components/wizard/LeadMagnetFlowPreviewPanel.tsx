import { useTranslation } from 'react-i18next';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import {
  FLOW_PREVIEW_SCENARIOS,
  branchLabelKey,
  previewFlowBranch,
} from '../../lib/contactGate/skipMatrixPreview';

type LeadMagnetFlowPreviewPanelProps = {
  form: Pick<
    LeadMagnetCampaignForm,
    'email_collection_enabled' | 'contact_gate_enabled' | 'skip_follow_gate_if_follower'
  >;
};

export function LeadMagnetFlowPreviewPanel({ form }: LeadMagnetFlowPreviewPanelProps) {
  const { t } = useTranslation();

  if (!form.email_collection_enabled && !form.contact_gate_enabled) {
    return (
      <p className="text-sm text-muted-foreground">{t('leadMagnet.contactGate.previewOff')}</p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
      <p className="text-sm font-medium">{t('leadMagnet.contactGate.previewTitle')}</p>
      <ul className="space-y-1 text-sm">
        {FLOW_PREVIEW_SCENARIOS.map((scenario) => {
          const branch = previewFlowBranch({
            emailCollectionEnabled: form.email_collection_enabled,
            contactGateEnabled: form.contact_gate_enabled,
            isFollower: scenario.isFollower,
            profile: scenario.profile,
          });
          return (
            <li key={scenario.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="font-medium text-foreground">{t(scenario.labelKey)}</span>
              <span aria-hidden>→</span>
              <span>{t(branchLabelKey(branch))}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t('leadMagnet.contactGate.previewNote')}</p>
    </div>
  );
}
