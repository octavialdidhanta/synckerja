import { Settings, Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { YouTubeContentAccountRow } from "@/youtube-content/hooks/useYouTubeContentSettings";

type YouTubeContentAccountNavProps = {
  accounts: YouTubeContentAccountRow[];
  channelId: string;
  onChannelIdChange: (channelId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

export function YouTubeContentAccountNav({
  accounts,
  channelId,
  onChannelIdChange,
  settingsActive,
  onSettingsSelect,
  className,
}: YouTubeContentAccountNavProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex h-full w-[180px] shrink-0 flex-col border-r border-gray-200 bg-gray-50/80", className)}>
      <div className="border-b border-gray-200/80 px-3 py-3">
        <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("digitalMarketing.youtubeContent.accounts", "Channels")}
        </p>
        <div className="space-y-1">
          {accounts.map((acc) => {
            const active = acc.channel_id === channelId;
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
                onClick={() => onChannelIdChange(acc.channel_id)}
              >
                {acc.thumbnail_url ? (
                  <img src={acc.thumbnail_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                ) : (
                  <Youtube className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{acc.label || acc.display_name || acc.channel_id}</span>
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
            {t("digitalMarketing.youtubeContent.settings", "Settings")}
          </button>
        </div>
      )}
    </div>
  );
}
