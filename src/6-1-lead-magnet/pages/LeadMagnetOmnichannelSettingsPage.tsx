import { Navigate } from 'react-router-dom';
import { LEAD_MAGNET_PATHS } from '@/6-1-lead-magnet/lib/leadMagnetPaths';
import { LeadMagnetSettingsLinkCard } from '@/5-3-dashboard/omnichannel-settings/components/lead-magnet/LeadMagnetSettingsLinkCard';

export function LeadMagnetOmnichannelSettingsPage() {
  return (
    <div className="space-y-4 p-4">
      <LeadMagnetSettingsLinkCard />
      <p className="text-sm text-muted-foreground">
        Atau buka langsung{' '}
        <a href={LEAD_MAGNET_PATHS.list} className="text-primary underline">
          Digital Marketing → Lead Magnet
        </a>
      </p>
    </div>
  );
}

export function LeadMagnetOmnichannelRedirect() {
  return <Navigate to={LEAD_MAGNET_PATHS.list} replace />;
}
