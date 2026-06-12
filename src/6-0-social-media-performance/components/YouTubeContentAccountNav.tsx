import { Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { YouTubeContentAccountRow } from "@/youtube-content/hooks/useYouTubeContentSettings";
import { CollapsibleContentAccountNav } from "@/6-0-social-media-performance/components/CollapsibleContentAccountNav";

const COLLAPSED_STORAGE_KEY = "synckerja.youtube-content-account-nav.collapsed";

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
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY}
      sectionLabel={t("digitalMarketing.youtubeContent.accounts", "Channels")}
      collapseLabel={t(
        "digitalMarketing.youtubeContent.collapseChannels",
        "Collapse channels",
      )}
      expandLabel={t("digitalMarketing.youtubeContent.expandChannels", "Expand channels")}
      settingsLabel={t("digitalMarketing.youtubeContent.settings", "Settings")}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={accounts.map((acc) => {
        const active = acc.channel_id === channelId;
        const label = acc.label || acc.display_name || acc.channel_id;

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
            onClick={() => onChannelIdChange(acc.channel_id)}
          >
            {acc.thumbnail_url ? (
              <img
                src={acc.thumbnail_url}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <Youtube className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    />
  );
}
