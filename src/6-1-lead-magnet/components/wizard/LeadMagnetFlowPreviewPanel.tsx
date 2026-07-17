import { useTranslation } from 'react-i18next';
import {
  branchLabel,
  FLOW_PREVIEW_SCENARIOS,
  previewFlowBranch,
} from '../../lib/contactGate/skipMatrixPreview';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';

type LeadMagnetFlowPreviewPanelProps = {
  form: Pick<LeadMagnetCampaignForm, 'contact_gate_enabled' | 'skip_follow_gate_if_follower'>;
};

export function LeadMagnetFlowPreviewPanel({ form }: LeadMagnetFlowPreviewPanelProps) {
  const { t } = useTranslation();

  if (!form.contact_gate_enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('leadMagnet.contactGate.previewOff', 'Contact Gate nonaktif — flow mengikuti pengaturan Pesan & Delivery.')}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">
        {t('leadMagnet.contactGate.previewTitle', 'Preview alur (Contact Gate ON)')}
      </p>
      <ul className="space-y-1.5 text-sm">
        {FLOW_PREVIEW_SCENARIOS.map((scenario) => {
          const branch = previewFlowBranch({
            contactGateEnabled: form.contact_gate_enabled,
            skipFollowGateIfFollower: form.skip_follow_gate_if_follower,
            isFollower: scenario.isFollower,
            profile: scenario.profile,
          });
          return (
            <li key={scenario.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-medium text-foreground">{scenario.label}</span>
              <span className="text-muted-foreground">→ {branchLabel(branch)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t(
          'leadMagnet.contactGate.previewNote',
          'Material Offer selalu dilewati saat Contact Gate aktif. Setelah kontak valid, materi dikirim via WA/email — tanpa DM konfirmasi IG. Profil lengkap (WA+email) menerima link via DM IG saja.',
        )}
      </p>
    </div>
  );
}
