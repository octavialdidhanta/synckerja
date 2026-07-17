import { Magnet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModuleTabNavItem } from '@/shared/auth/page-access/ModuleTabNavItem';
import { LEAD_MAGNET_BASE_PATH, LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';

const tabActive = 'border-primary text-primary';
const tabInactive =
  'border-transparent text-muted-foreground hover:border-border hover:text-foreground';

export function LeadMagnetHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isCampaign = location.pathname.startsWith(LEAD_MAGNET_BASE_PATH);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t('sidebar.digitalMarketing.leadMagnet.title', 'Lead Magnet')}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t(
            'sidebar.digitalMarketing.leadMagnet.description',
            'Automation comment → DM',
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={LEAD_MAGNET_BASE_PATH}
            label={t('leadMagnet.tabs.campaigns', 'Campaign')}
            icon={Magnet}
            isActive={isCampaign}
            onActivate={() => navigate(LEAD_MAGNET_PATHS.list)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

LeadMagnetHeaderAndTab.displayName = 'LeadMagnetHeaderAndTab';
