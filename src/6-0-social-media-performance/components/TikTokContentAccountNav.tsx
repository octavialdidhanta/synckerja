import { Settings, UserCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { TikTokContentAccountRow } from "@/tiktok-content/hooks/useTikTokContentSettings";

type TikTokContentAccountNavProps = {
  accounts: TikTokContentAccountRow[];
  openId: string;
  onOpenIdChange: (openId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

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
    <div className={cn("flex h-full w-[180px] shrink-0 flex-col border-r border-gray-200 bg-gray-50/80", className)}>
      <div className="border-b border-gray-200/80 px-3 py-3">
        <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("digitalMarketing.tiktokContent.accounts", "Accounts")}
        </p>
        <div className="space-y-1">
          {accounts.map((acc) => {
            const active = acc.open_id === openId;
            return (
              <button
                key={acc.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-gray-200/80 font-medium text-gray-900"
                    : "text-gray-700 hover:bg-gray-100",
                )}
                onClick={() => onOpenIdChange(acc.open_id)}
              >
                <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{acc.label || acc.display_name || acc.open_id}</span>
              </button>
            );
          })}
        </div>
      </div>
      {onSettingsSelect && (
        <div className="mt-auto border-t border-gray-200/80 px-3 py-3">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              settingsActive
                ? "bg-gray-200/80 font-medium text-gray-900"
                : "text-gray-700 hover:bg-gray-100",
            )}
            onClick={onSettingsSelect}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {t("digitalMarketing.tiktokContent.settings", "Settings")}
          </button>
        </div>
      )}
    </div>
  );
}
