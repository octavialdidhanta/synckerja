import { Package, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModuleTabNavItem } from '@/shared/auth/page-access/ModuleTabNavItem';
import {
  BLIBLI_ORDERS_BASE_PATH,
  BLIBLI_ORDERS_PAGE_PATH,
  BLIBLI_ORDERS_SETTINGS_PATH,
  isBlibliOrdersSettingsPath,
} from '@/blibli-orders/lib/blibliOrdersPaths';

const tabActive = 'border-primary text-primary';
const tabInactive =
  'border-transparent text-muted-foreground hover:border-border hover:text-foreground';

export function BlibliOrdersHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = isBlibliOrdersSettingsPath(location.pathname);
  const isOrders = !isSettings;

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t('operations.blibliOrders.title')}
        </h1>
        <p className="text-xs text-gray-600">{t('operations.blibliOrders.headerDesc')}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={BLIBLI_ORDERS_BASE_PATH}
            label={t('operations.blibliOrders.tabOrders')}
            icon={Package}
            isActive={isOrders}
            onActivate={() => navigate(BLIBLI_ORDERS_PAGE_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={BLIBLI_ORDERS_BASE_PATH}
            label={t('operations.blibliOrders.tabSettings')}
            icon={Settings}
            isActive={isSettings}
            onActivate={() => navigate(BLIBLI_ORDERS_SETTINGS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

BlibliOrdersHeaderAndTab.displayName = 'BlibliOrdersHeaderAndTab';
