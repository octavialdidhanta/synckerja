import { useState } from "react";
import { AlertTriangle, Ban, Check, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { rupiah } from "../lib/recipeDraftFormat";
import type { RecipeDraftListItem } from "../types";

const COLLAPSED_COUNT = 3;

export type RecipeDraftBannerProps = {
  drafts: RecipeDraftListItem[];
  onReview: (draftId: string) => void;
};

/** Open drafts from Claude, above the Recipes table. Nothing here is live in POS yet. */
export function RecipeDraftBanner({ drafts, onReview }: RecipeDraftBannerProps) {
  const { t, dateLocale } = useAppTranslation();
  const [expanded, setExpanded] = useState(false);
  if (drafts.length === 0) return null;

  const visible = expanded ? drafts : drafts.slice(0, COLLAPSED_COUNT);
  const hidden = drafts.length - visible.length;

  return (
    <section
      aria-label={t("recipeDrafts.banner.aria", "Recipe drafts from Claude")}
      className="mb-3 shrink-0 overflow-hidden rounded-xl border border-blue-200 bg-white"
    >
      <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
          <FileText className="h-[18px] w-[18px] text-blue-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900">
            {drafts.length === 1
              ? t("recipeDrafts.banner.titleOne", "1 recipe draft from Claude awaiting review")
              : t("recipeDrafts.banner.title", "{{count}} recipe drafts from Claude awaiting review", {
                  count: drafts.length,
                })}
          </p>
          <p className="text-xs text-blue-800">
            {t(
              "recipeDrafts.banner.subtitle",
              "Drafts are not used by POS. Stock and HPP change only after you click Publish.",
            )}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {visible.map((draft) => {
          const tone = draft.blocked ? "blocked" : draft.warning_count > 0 ? "warning" : "ready";
          return (
            <li key={draft.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
              <div className="min-w-[200px] flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{draft.product_name}</p>
                <p className="text-xs text-gray-600">
                  {draft.draft_type === "new"
                    ? t("recipeDrafts.type.new", "New recipe")
                    : t("recipeDrafts.type.update", "Recipe change")}
                  {" · "}
                  {draft.line_count === 1
                    ? t("recipeDrafts.banner.linesOne", "1 ingredient")
                    : t("recipeDrafts.banner.lines", "{{count}} ingredients", { count: draft.line_count })}
                  {draft.requested_by_name ? ` · ${draft.requested_by_name}` : ""}
                  {" · "}
                  {new Date(draft.created_at).toLocaleString(dateLocale, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="min-w-[140px]">
                <p className="text-xs text-gray-600">{t("recipeDrafts.hppPerPortion", "HPP per portion")}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {draft.hpp_before == null ? "—" : rupiah(draft.hpp_before)} → {rupiah(draft.hpp_after)}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  tone === "blocked" && "bg-red-50 text-red-800",
                  tone === "warning" && "bg-orange-50 text-orange-800",
                  tone === "ready" && "bg-green-50 text-green-800",
                )}
              >
                {tone === "blocked" ? (
                  <Ban className="h-3.5 w-3.5" aria-hidden />
                ) : tone === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                {tone === "blocked"
                  ? t("recipeDrafts.banner.blocked", "Cannot publish")
                  : tone === "warning"
                    ? t("recipeDrafts.banner.warnings", "{{count}} to check", { count: draft.warning_count })
                    : t("recipeDrafts.banner.ready", "Ready to publish")}
              </span>
              <Button
                type="button"
                variant={tone === "ready" ? "outline" : "default"}
                onClick={() => onReview(draft.id)}
              >
                {t("recipeDrafts.banner.review", "Review")}
              </Button>
            </li>
          );
        })}
      </ul>

      {hidden > 0 || expanded ? (
        <div className="border-t border-gray-100 px-4 py-2">
          <Button type="button" variant="link" className="h-8 px-0" onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? t("recipeDrafts.banner.showLess", "Show less")
              : t("recipeDrafts.banner.showMore", "Show {{count}} more", { count: hidden })}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
