import { ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  parseAdCreativeFromIdentity,
  truncateDescription,
} from "@/google-ads/metrics/parseAdCreative";
import type { GoogleAdsMetricsRow } from "@/google-ads/metrics/types";

type Props = {
  row: GoogleAdsMetricsRow;
  className?: string;
};

const HEADLINE_VISIBLE = 3;

export function GoogleAdsAdPreviewCell({ row, className }: Props) {
  const creative = parseAdCreativeFromIdentity(row.identity);
  const headlines = creative.headlines;
  const visibleHeadlines = headlines.slice(0, HEADLINE_VISIBLE);
  const moreHeadlines = headlines.length - HEADLINE_VISIBLE;
  const description = creative.descriptions[0]
    ? truncateDescription(creative.descriptions[0])
    : "";
  const fallbackTitle =
    headlines.length === 0
      ? String(row.identity.ad_preview ?? row.id ?? "—")
      : null;

  return (
    <div className={cn("group flex min-w-[min(420px,70vw)] items-start gap-2 py-1 pr-2", className)}>
      <button
        type="button"
        className="mt-1 shrink-0 text-[#70757a] hover:text-gray-900"
        aria-label="Expand ad row"
        tabIndex={-1}
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1 space-y-0.5">
        {fallbackTitle ? (
          <p className="text-sm text-[#1a73e8]">{fallbackTitle}</p>
        ) : (
          <p className="text-sm leading-snug">
            {visibleHeadlines.map((h, i) => (
              <span key={`${h}-${i}`}>
                {i > 0 ? (
                  <span className="mx-1 text-[#70757a]" aria-hidden>
                    |
                  </span>
                ) : null}
                <span className="text-[#1a0dab] hover:underline">{h}</span>
              </span>
            ))}
            {moreHeadlines > 0 ? (
              <span className="ml-1 text-sm text-[#70757a]">+{moreHeadlines} more</span>
            ) : null}
          </p>
        )}

        {creative.display_url ? (
          <p className="text-sm text-[#006621]">{creative.display_url}</p>
        ) : null}

        {description ? (
          <p className="text-sm leading-snug text-[#3c4043]">{description}</p>
        ) : null}

        <p className="pt-0.5 text-xs">
          <button
            type="button"
            className="text-[#1a73e8] hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            View assets details
          </button>
          <span className="mx-1 text-[#70757a]" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-[#1a73e8] hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            Preview ads
          </button>
        </p>
      </div>

      <button
        type="button"
        className="mt-0.5 shrink-0 rounded p-1 text-[#70757a] opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100 focus:opacity-100"
        aria-label="Edit ad"
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
