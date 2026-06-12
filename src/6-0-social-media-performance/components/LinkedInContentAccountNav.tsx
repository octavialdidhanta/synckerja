import { Linkedin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { LinkedInContentAccountRow } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import { CollapsibleContentAccountNav } from "@/6-0-social-media-performance/components/CollapsibleContentAccountNav";

const COLLAPSED_STORAGE_KEY = "synckerja.linkedin-content-account-nav.collapsed";

type LinkedInContentAccountNavProps = {
  accounts: LinkedInContentAccountRow[];
  pageId: string;
  onPageIdChange: (pageId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

export function LinkedInContentAccountNav({
  accounts,
  pageId,
  onPageIdChange,
  settingsActive,
  onSettingsSelect,
  className,
}: LinkedInContentAccountNavProps) {
  const { t } = useTranslation();

  return (
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY}
      sectionLabel={t("digitalMarketing.linkedinContent.accounts", "Pages")}
      collapseLabel={t(
        "digitalMarketing.linkedinContent.collapsePages",
        "Collapse pages",
      )}
      expandLabel={t("digitalMarketing.linkedinContent.expandPages", "Expand pages")}
      settingsLabel={t("digitalMarketing.linkedinContent.settings", "Settings")}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={accounts.map((acc) => {
        const active = acc.page_id === pageId;
        const label = acc.label || acc.display_name || acc.page_id;

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
            onClick={() => onPageIdChange(acc.page_id)}
          >
            {acc.thumbnail_url ? (
              <img
                src={acc.thumbnail_url}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <Linkedin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    />
  );
}
