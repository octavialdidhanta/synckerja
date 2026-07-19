import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { BLIBLI_ORDERS_SETTINGS_PATH } from '@/blibli-orders/lib/blibliOrdersPaths';
import {
  useBlibliSellerSettings,
  type BlibliSellerConnectionRow,
} from '../hooks/useBlibliSellerSettings';
import { BlibliConnectWizard } from './blibli-connect/BlibliConnectWizard';

type Props = {
  organizationId: string | null | undefined;
  /**
   * Compact mode (E-Commerce Chat): show status + CTA linking to Blibli Shop Settings wizard.
   */
  compact?: boolean;
  /**
   * When true (Settings page), skip nested bordered shell around wizard.
   */
  embedded?: boolean;
  className?: string;
};

export function BlibliSellerConnectPanel({
  organizationId,
  compact = false,
  embedded = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const { data, isPending, connect, disconnect, setDefault } = useBlibliSellerSettings(organizationId);
  const [showWizard, setShowWizard] = useState(false);

  const connections = data?.connections ?? [];
  const serverConfigured = data?.serverConfigured !== false;
  const apiClientId = data?.apiClientId ?? null;

  // Settings: wizard when no stores yet, or after "Add store"
  const wizardVisible = !compact && (showWizard || connections.length === 0);

  if (!organizationId) {
    return (
      <p className="text-sm text-muted-foreground">{t('operations.ecommerceChat.blibli.noOrg')}</p>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{t('operations.ecommerceChat.blibli.loadingSettings')}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={className}>
        {!serverConfigured && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t('operations.ecommerceChat.blibli.serverNotConfiguredTitle')}</AlertTitle>
            <AlertDescription>
              {t('operations.ecommerceChat.blibli.serverNotConfiguredDesc')}
            </AlertDescription>
          </Alert>
        )}
        {connections.length > 0 && (
          <ul className="mb-3 space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <p className="truncate font-medium">
                  {c.display_name?.trim() || c.store_code}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.username}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {connections.length > 0
              ? t('operations.blibliOrders.connectWizard.compactManageHint')
              : t('operations.ecommerceChat.blibli.connectHint')}
          </p>
          <Button type="button" size="sm" asChild>
            <Link to={BLIBLI_ORDERS_SETTINGS_PATH}>
              {connections.length > 0
                ? t('operations.blibliOrders.connectWizard.openSettings')
                : t('operations.ecommerceChat.blibli.connectCta')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {!serverConfigured && (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>{t('operations.ecommerceChat.blibli.serverNotConfiguredTitle')}</AlertTitle>
          <AlertDescription>
            {t('operations.ecommerceChat.blibli.serverNotConfiguredDesc')}
          </AlertDescription>
        </Alert>
      )}

      {connections.length > 0 && (
        <ul className="mb-4 space-y-2">
          {connections.map((c) => (
            <ConnectionRow
              key={c.id}
              connection={c}
              disconnecting={disconnect.isPending}
              settingDefault={setDefault.isPending}
              onDisconnect={() => {
                void disconnect
                  .mutateAsync(c.id)
                  .then(() => {
                    toast.success(t('operations.ecommerceChat.blibli.disconnectSuccess'));
                  })
                  .catch((err) => {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : t('operations.ecommerceChat.blibli.disconnectError'),
                    );
                  });
              }}
              onSetDefault={() => {
                void setDefault
                  .mutateAsync(c.id)
                  .then(() => {
                    toast.success(t('operations.ecommerceChat.blibli.setDefaultSuccess'));
                  })
                  .catch((err) => {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : t('operations.ecommerceChat.blibli.setDefaultError'),
                    );
                  });
              }}
            />
          ))}
        </ul>
      )}

      {!wizardVisible && connections.length > 0 && (
        <Button type="button" size="sm" onClick={() => setShowWizard(true)}>
          {t('operations.ecommerceChat.blibli.addStore')}
        </Button>
      )}

      {wizardVisible && (
        <div className={embedded ? undefined : 'rounded-md border border-border bg-muted/20 p-3'}>
          <BlibliConnectWizard
            apiClientId={apiClientId}
            serverConfigured={serverConfigured}
            isFirstStore={connections.length === 0}
            connect={connect}
            onCancel={
              connections.length > 0
                ? () => setShowWizard(false)
                : undefined
            }
            onSuccess={() => setShowWizard(false)}
          />
        </div>
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  onDisconnect,
  onSetDefault,
  disconnecting,
  settingDefault,
}: {
  connection: BlibliSellerConnectionRow;
  onDisconnect: () => void;
  onSetDefault: () => void;
  disconnecting: boolean;
  settingDefault: boolean;
}) {
  const { t } = useTranslation();
  const label = connection.display_name?.trim() || connection.store_code;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {label}
          {connection.is_default && (
            <span className="ml-2 text-[10px] font-normal uppercase text-muted-foreground">
              {t('operations.ecommerceChat.blibli.defaultBadge')}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {connection.store_code} · {connection.username}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {!connection.is_default && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={settingDefault}
            onClick={onSetDefault}
          >
            {t('operations.ecommerceChat.blibli.setDefault')}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disconnecting}
          onClick={onDisconnect}
          aria-label={t('operations.ecommerceChat.blibli.disconnect')}
        >
          <Unplug className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
