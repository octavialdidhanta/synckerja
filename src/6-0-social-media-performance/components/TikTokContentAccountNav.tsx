import { UserCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { TikTokContentAccountRow } from "@/tiktok-content/hooks/useTikTokContentSettings";
import { getTikTokAccountDisplayLabel } from "@/tiktok-content/lib/tiktokAccountDisplayLabel";
import { CollapsibleContentAccountNav } from "@/6-0-social-media-performance/components/CollapsibleContentAccountNav";

const COLLAPSED_STORAGE_KEY = "synckerja.tiktok-content-account-nav.collapsed";

type TikTokContentAccountNavProps = {
  accounts: TikTokContentAccountRow[];
  openId: string;
  onOpenIdChange: (openId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

function accountLabel(acc: TikTokContentAccountRow): string {
  return getTikTokAccountDisplayLabel(acc);
}

export function TikTokContentAccountNav({
  accounts,
  openId,
  onOpenIdChange,
  settingsActive,
  onSettingsSelect,
  className,
}: TikTokContentAccountNavProps) {
  const { t } = useTranslation();

  return (
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY}
      sectionLabel={t("digitalMarketing.tiktokContent.accounts", "Accounts")}
      collapseLabel={t(
        "digitalMarketing.tiktokContent.collapseAccounts",
        "Collapse accounts",
      )}
      expandLabel={t("digitalMarketing.tiktokContent.expandAccounts", "Expand accounts")}
      settingsLabel={t("digitalMarketing.tiktokContent.settings", "Settings")}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={accounts.map((acc) => {
        const active = acc.open_id === openId;
        const label = accountLabel(acc);

        return (
          <button
            key={acc.id}
            type="button"
            title={label}
            aria-label={label}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active
                ? "bg-gray-200/80 font-medium text-gray-900"
                : "text-gray-700 hover:bg-gray-100",
            )}
            onClick={() => onOpenIdChange(acc.open_id)}
          >
            {acc.avatar_url ? (
              <img
                src={acc.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-4 w-4 shrink-0 rounded-full object-cover"
              />
            ) : (
              <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    />
  );
}
