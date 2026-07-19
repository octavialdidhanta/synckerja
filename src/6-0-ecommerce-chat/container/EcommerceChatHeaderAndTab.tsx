import { MessageSquare, ShoppingBag } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModuleTabNavItem } from '@/shared/auth/page-access/ModuleTabNavItem';
import {
  ECOMMERCE_CHAT_BASE_PATH,
  ecommerceChatPlatformPath,
  parseEcommerceChatPlatform,
  type EcommerceChatPlatform,
} from '../lib/ecommerceChatPaths';

const tabActive = 'border-primary text-primary';
const tabInactive =
  'border-transparent text-muted-foreground hover:border-border hover:text-foreground';

const PLATFORM_TABS: Array<{
  platform: EcommerceChatPlatform;
  labelKey: string;
  icon: typeof MessageSquare;
}> = [
  { platform: 'all', labelKey: 'operations.ecommerceChat.tabAll', icon: MessageSquare },
  { platform: 'shopee', labelKey: 'operations.ecommerceChat.platforms.shopee', icon: ShoppingBag },
  { platform: 'tiktok', labelKey: 'operations.ecommerceChat.platforms.tiktok', icon: ShoppingBag },
  { platform: 'blibli', labelKey: 'operations.ecommerceChat.platforms.blibli', icon: ShoppingBag },
];

export function EcommerceChatHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { platform: platformParam } = useParams<{ platform?: string }>();
  const activePlatform =
    location.pathname === ECOMMERCE_CHAT_BASE_PATH
      ? 'all'
      : parseEcommerceChatPlatform(platformParam);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t('operations.ecommerceChat.title')}
        </h1>
        <p className="text-xs text-gray-600">{t('operations.ecommerceChat.headerDesc')}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" role="tablist">
          {PLATFORM_TABS.map((tab) => (
            <ModuleTabNavItem
              key={tab.platform}
              pagePath={ECOMMERCE_CHAT_BASE_PATH}
              label={t(tab.labelKey)}
              icon={tab.icon}
              isActive={activePlatform === tab.platform}
              onActivate={() => navigate(ecommerceChatPlatformPath(tab.platform))}
              activeClassName={tabActive}
              inactiveClassName={tabInactive}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

EcommerceChatHeaderAndTab.displayName = 'EcommerceChatHeaderAndTab';
