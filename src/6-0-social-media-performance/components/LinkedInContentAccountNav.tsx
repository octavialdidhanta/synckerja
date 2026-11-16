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

function kindRank(kind: string | null | undefined): number {
  return String(kind ?? "organization") === "person" ? 1 : 0;
}

export function LinkedInContentAccountNav({
  accounts,
  pageId,
  onPageIdChange,
  settingsActive,
  onSettingsSelect,
  className,
}: LinkedInContentAccountNavProps) {
  const { t } = useTranslation();
  const ordered = [...accounts].sort((a, b) => {
    const kindOrder = kindRank(a.account_kind) - kindRank(b.account_kind);
    if (kindOrder !== 0) return kindOrder;
    const defaultOrder = Number(Boolean(b.is_default)) - Number(Boolean(a.is_default));
    if (defaultOrder !== 0) return defaultOrder;
    return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  });

  return (
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY}
      sectionLabel={t("digitalMarketing.linkedinContent.accounts", "Accounts")}
      collapseLabel={t(
        "digitalMarketing.linkedinContent.collapsePages",
        "Collapse accounts",
      )}
      expandLabel={t("digitalMarketing.linkedinContent.expandPages", "Expand accounts")}
      settingsLabel={t("digitalMarketing.linkedinContent.settings", "Settings")}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={ordered.map((acc) => {
        const active = acc.page_id === pageId;
        const isPerson = String(acc.account_kind ?? "organization") === "person";
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
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {isPerson ? (
              <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
                {t("digitalMarketing.linkedinContent.accountKindPersonal", "Personal")}
              </span>
            ) : null}
          </button>
        );
      })}
    />
  );
}
