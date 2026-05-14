import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

export type TemplateManagerSubTab = "templates" | "groups";

export function TemplateManagerShell({
  activeSubTab,
  onSubTabChange,
  children,
}: {
  activeSubTab: TemplateManagerSubTab;
  onSubTabChange: (t: TemplateManagerSubTab) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => onSubTabChange("templates")}
          className={cn(
            "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
            activeSubTab === "templates" ? "border-brand-blue text-brand-blue" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("whatsappTemplates.subTab.templates")}
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange("groups")}
          className={cn(
            "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
            activeSubTab === "groups" ? "border-brand-blue text-brand-blue" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("whatsappTemplates.subTab.groups")}
        </button>
      </div>
      {activeSubTab === "templates" ? (
        children
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-12 text-center text-sm text-muted-foreground">
          {t("whatsappTemplates.subTab.groupsComingSoon")}
        </div>
      )}
    </div>
  );
}
