import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";

export type MobileSmpContentListItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  coverImageUrl?: string | null;
  metrics: Array<{ label: string; value: string }>;
};

type MobileSmpContentListProps = {
  items: MobileSmpContentListItem[];
  isLoading?: boolean;
  emptyText: string;
  onItemSelect?: (id: string) => void;
};

export function MobileSmpContentList({
  items,
  isLoading,
  emptyText,
  onItemSelect,
}: MobileSmpContentListProps) {
  if (isLoading && items.length === 0) {
    return (
      <div className="-mx-2 border-y border-border bg-card p-3 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="-mx-2 border-y border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="-mx-2 divide-y divide-border border-y border-border bg-card">
      {items.map((item) => {
        const body = (
          <>
            {item.coverImageUrl ? (
              <img
                src={item.coverImageUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md object-cover bg-muted"
              />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.subtitle}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
                {item.metrics.map((metric) => (
                  <span key={metric.label}>
                    {metric.label} {metric.value}
                  </span>
                ))}
              </div>
            </div>
            {onItemSelect ? (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
          </>
        );

        if (onItemSelect) {
          return (
            <button
              key={item.id}
              type="button"
              className="flex w-full gap-3 px-3 py-3 text-left touch-manipulation"
              onClick={() => onItemSelect(item.id)}
            >
              {body}
            </button>
          );
        }

        return (
          <article key={item.id} className="flex gap-3 px-3 py-3">
            {body}
          </article>
        );
      })}
    </div>
  );
}
