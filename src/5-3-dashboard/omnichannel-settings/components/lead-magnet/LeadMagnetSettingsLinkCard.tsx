import { Link } from 'react-router-dom';
import { Magnet, ArrowRight } from 'lucide-react';
import { LEAD_MAGNET_PATHS } from '@/6-1-lead-magnet/lib/leadMagnetPaths';
import { Button } from '@/shared/components/ui/button';

/** Quick link card under Omnichannel settings → redirects to Digital Marketing module. */
export function LeadMagnetSettingsLinkCard() {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start gap-3">
        <Magnet className="mt-0.5 h-5 w-5 text-primary" />
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold">Lead Magnet Automation</h3>
            <p className="text-sm text-muted-foreground">
              Keyword di komentar → auto DM follow gate → kirim link framework.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to={LEAD_MAGNET_PATHS.list}>
              Kelola campaign
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
