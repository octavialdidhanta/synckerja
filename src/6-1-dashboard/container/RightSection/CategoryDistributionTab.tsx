import React, { useEffect, useMemo, useState } from 'react';
import { MoreVertical, RefreshCw, Wifi } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toast } from 'sonner';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { pillarBarWidth } from '../../lib/contentPillarTracker';
import { signSubServicePhotos } from '../../lib/subServicePhoto';
import { useCategoryDistribution, type SubCategoryDistributionItem } from '../../hook/useCategoryDistribution';

const EMPTY_SUB_CATEGORIES: SubCategoryDistributionItem[] = [];

function SubCategoryName({ name }: { name: string }) {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const update = () => {
      const next = element.scrollWidth > element.clientWidth + 1;
      setTruncated(next);
      if (!next) setOpen(false);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);

  return (
    <Tooltip open={truncated && open} onOpenChange={(next) => setOpen(truncated && next)}>
      <TooltipTrigger asChild>
        <span ref={textRef} className="block min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words text-left">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

interface CategoryDistributionTabProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const CategoryDistributionTab = ({ selectedMonth, serviceFilter }: CategoryDistributionTabProps) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useCategoryDistribution(selectedMonth, serviceFilter);

  const categories = data?.categories ?? [];
  const subCategories = data?.subCategories ?? EMPTY_SUB_CATEGORIES;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoKey = useMemo(
    () => subCategories.map((item) => `${item.id}:${item.imagePath ?? ''}`).join('|'),
    [subCategories],
  );

  useEffect(() => {
    const paths = subCategories.flatMap((item) => (item.imagePath ? [item.imagePath] : []));
    let cancelled = false;
    void signSubServicePhotos(paths).then((urls) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const item of subCategories) {
        const signed = item.imagePath ? urls.get(item.imagePath) : undefined;
        if (signed) next[item.id] = signed;
      }
      setPhotoUrls((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(next);
        if (
          currentKeys.length === nextKeys.length &&
          nextKeys.every((id) => current[id] === next[id])
        ) {
          return current;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [photoKey, subCategories]);
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ??
    categories.find((category) => category.count > 0) ??
    categories[0];

  useEffect(() => {
    if (!selectedCategory) return;
    if (selectedCategoryId === selectedCategory.id) return;
    if (selectedCategoryId && categories.some((category) => category.id === selectedCategoryId)) return;
    setSelectedCategoryId(selectedCategory.id);
  }, [categories, selectedCategory, selectedCategoryId]);
  const monthLabel = (selectedMonth || new Date()).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  const handleManualRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['categoryDistribution', organizationId] });
    await queryClient.invalidateQueries({ queryKey: ['social-media-plans', organizationId] });
    await queryClient.invalidateQueries({ queryKey: ['social-media-master', organizationId] });
    await refetch();
    toast.success('Data refreshed');
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-12 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
          <p className="text-sm text-red-600">Error loading data</p>
        </div>
        <div className="p-4">
          <Button variant="outline" size="sm" onClick={() => void handleManualRefresh()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-200 p-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-1 text-xs text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <div className="mb-2 text-sm text-gray-600">
            {selectedMonth ? 'Selected' : 'Current'} Month Distribution ({monthLabel}) - Total: {data?.total ?? 0} content
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void handleManualRefresh()} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No categories yet</p>
        ) : (
          categories.map((category) => {
            const selected = category.id === selectedCategory?.id;
            const items = subCategories.filter((item) => item.serviceId === category.id);
            return (
              <section key={category.id} className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-[5px] px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border border-brand-blue/30 bg-brand-blue/10 text-brand-blue'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-medium">{category.name}</span>
                  <span className="shrink-0 text-sm font-semibold">
                    {category.percentage}% ({category.count})
                  </span>
                </button>
                {selected ? (
                  items.length === 0 ? (
                    <p className="py-2 text-center text-sm text-gray-500">No sub categories for this category</p>
                  ) : (
                    <TooltipProvider delayDuration={300}>
                      <div className="space-y-3">
                        {items.map((item) => {
                          const photoUrl = photoUrls[item.id];
                          return (
                            <div key={item.id} className="flex items-center gap-2">
                              {item.imagePath ? (
                                photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded border border-gray-200 object-cover"
                                  />
                                ) : (
                                  <div className="h-8 w-8 shrink-0 rounded border border-gray-200 bg-gray-100" aria-hidden />
                                )
                              ) : null}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <SubCategoryName name={item.name} />
                                  <span className="shrink-0 text-sm font-medium text-gray-900">{item.count}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                  <div
                                    className="h-full rounded-full bg-brand-blue transition-all duration-300"
                                    style={{ width: `${pillarBarWidth(item.count)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  )
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
