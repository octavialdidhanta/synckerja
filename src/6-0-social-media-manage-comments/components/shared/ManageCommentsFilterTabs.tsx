import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { ManageCommentsPostFilter } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type ManageCommentsFilterTabsProps = {
  value: ManageCommentsPostFilter;
  onChange: (value: ManageCommentsPostFilter) => void;
};

const FILTERS: ManageCommentsPostFilter[] = [
  "all",
  "unread",
  "with_comments",
  "no_comments",
];

export function ManageCommentsFilterTabs({ value, onChange }: ManageCommentsFilterTabsProps) {
  const { t } = useTranslation();

  const labels: Record<ManageCommentsPostFilter, string> = {
    all: t("digitalMarketing.manageComments.filterAll", "All"),
    unread: t("digitalMarketing.manageComments.filterUnread", "Unread"),
    with_comments: t(
      "digitalMarketing.manageComments.filterWithComments",
      "With comments",
    ),
    no_comments: t(
      "digitalMarketing.manageComments.filterNoComments",
      "No comments",
    ),
  };

  return (
    <div className="border-b border-gray-100 px-3 pb-0 pt-2">
      <div
        className="scrollbar-hide flex flex-nowrap items-center gap-x-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={value === filter}
            onClick={() => onChange(filter)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors",
              value === filter
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[filter]}
          </button>
        ))}
      </div>
    </div>
  );
}

ManageCommentsFilterTabs.displayName = "ManageCommentsFilterTabs";
