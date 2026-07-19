import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { BlibliSellerConnectionRow } from '@/6-0-ecommerce-chat/hooks/useBlibliSellerSettings';

type Props = {
  connections: BlibliSellerConnectionRow[];
  value: string | null;
  onChange: (connectionId: string) => void;
  disabled?: boolean;
};

export function BlibliOrdersStoreSelector({ connections, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  if (connections.length === 0) return null;

  return (
    <div className="flex min-w-[200px] flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">
        {t('operations.blibliOrders.storeLabel')}
      </span>
      <Select
        value={value ?? undefined}
        onValueChange={onChange}
        disabled={disabled || connections.length === 0}
      >
        <SelectTrigger className="h-9 w-full max-w-xs bg-background">
          <SelectValue placeholder={t('operations.blibliOrders.selectStore')} />
        </SelectTrigger>
        <SelectContent>
          {connections.map((c) => {
            const label = c.display_name?.trim() || c.store_code;
            return (
              <SelectItem key={c.id} value={c.id}>
                {label}
                {c.is_default ? ` (${t('operations.blibliOrders.defaultBadge')})` : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
