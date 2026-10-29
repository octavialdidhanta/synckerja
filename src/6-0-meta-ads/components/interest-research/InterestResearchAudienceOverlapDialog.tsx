import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  isMetaReachPrivacyFloor,
  midBound,
  useMetaAdsTargetingOverlapRows,
  useMetaAdsTargetingSearch,
  useMetaAdsTargetingSuggest,
  type InterestResearchFilters,
  type MetaEstimateRow,
  type MetaOverlapRow,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { InterestResearchOverlapSearchField } from "./InterestResearchOverlapSearchField";

const RELATED_COMPARE_TYPES = new Set<MetaTargetingItem["type"]>([
  "interest",
  "behavior",
  "demographic",
  "life_event",
  "industry",
  "income",
  "family_status",
]);

const GROUP_COMPARISON_ID = "__interest_group__";
const COMPARISON_UNION_ID = "__comparison_union__";
const SELECTED_GROUP_VALUE = "__selected_group__";
const GROUP_MEMBER_CAP = 8;
const COMPARISON_CAP = 20;
const OVERLAP_GRID_GROUP =
  "grid grid-cols-1 items-center gap-x-2 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.15fr)_180px_88px_120px_120px]";
const OVERLAP_GRID_SINGLE =
  "grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_180px_88px_120px_120px_36px]";

type OverlapMode = "single" | "group";

type GroupSnapshot = {
  members: MetaTargetingItem[];
  row: MetaOverlapRow;
};

type InterestResearchAudienceOverlapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters;
  checkedItems: MetaTargetingItem[];
  rowEstimates: Record<string, MetaEstimateRow>;
};

function nameMatchesQuery(item: MetaTargetingItem, query: string): boolean {
  const name = item.name.toLowerCase();
  const path = (item.path ?? []).join(" ").toLowerCase();
  return name.includes(query) || path.includes(query);
}

function rankSearchHits(
  query: string,
  searchItems: MetaTargetingItem[],
  relatedItems: MetaTargetingItem[],
  blocked: Set<string>,
): MetaTargetingItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const relatedIds = new Set(relatedItems.map((item) => item.id));
  const merged = new Map<string, MetaTargetingItem>();
  for (const item of [...searchItems, ...relatedItems]) {
    if (!item.id || blocked.has(item.id) || merged.has(item.id)) continue;
    const suggested = relatedIds.has(item.id);
    if (!suggested && !RELATED_COMPARE_TYPES.has(item.type)) continue;
    if (!nameMatchesQuery(item, q)) continue;
    merged.set(item.id, item);
  }
  return [...merged.values()]
    .map((item) => {
      const name = item.name.toLowerCase();
      let score = relatedIds.has(item.id) ? 40 : 0;
      if (name === q) score += 100;
      else if (name.startsWith(q)) score += 70;
      else if (name.includes(q)) score += 50;
      if (item.type === "interest") score += 8;
      else if (item.type === "behavior") score += 6;
      else if (item.type === "demographic") score += 6;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item)
    .slice(0, 20);
}

function AudienceChip({
  name,
  onRemove,
  disabled,
}: {
  name: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[12px] text-slate-700">
      <span className="truncate">{name}</span>
      <button
        type="button"
        className="shrink-0 text-slate-500 hover:text-slate-800 disabled:opacity-40"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function CompareSearchBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-200 bg-[#F4F5F7] px-4 py-2.5">
      <div className="mx-auto flex w-full max-w-[560px] items-center justify-center gap-3">
        <p className="shrink-0 text-[13px] font-medium text-slate-800">{label}</p>
        {children}
      </div>
    </div>
  );
}

function formatPeople(lower: number | null, upper: number | null): string {
  const mid = midBound(lower, upper);
  if (mid == null) return "—";
  if (isMetaReachPrivacyFloor(lower, upper)) return "≤1K";
  return Math.round(mid).toLocaleString("en-US");
}

function comparisonPotential(
  ov: MetaOverlapRow | undefined,
  estimate?: MetaEstimateRow,
): { lower: number | null; upper: number | null } {
  const direct = ov?.comparison_users ?? ov?.b;
  if (direct && (direct.users_lower != null || direct.users_upper != null)) {
    return { lower: direct.users_lower, upper: direct.users_upper };
  }
  const est = estimate?.potential;
  if (est && (est.users_lower != null || est.users_upper != null)) {
    return { lower: est.users_lower, upper: est.users_upper };
  }
  const andMid = midBound(ov?.and.users_lower ?? null, ov?.and.users_upper ?? null);
  const pctCom = ov?.pct_com ?? ov?.pct ?? null;
  if (andMid != null && pctCom != null && pctCom > 0) {
    const inferred = andMid / (pctCom / 100);
    return { lower: inferred, upper: inferred };
  }
  return { lower: null, upper: null };
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1) return "< 1%";
  return `${Math.round(value)}%`;
}

function toSeedItem(item: MetaTargetingItem, estimate?: MetaEstimateRow) {
  const potential = estimate?.potential;
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    path: item.path,
    potential_lower: potential?.users_lower ?? null,
    potential_upper: potential?.users_upper ?? null,
  };
}

function invertOverlapRow(
  row: MetaOverlapRow,
  groupId: string,
  groupReach?: { users_lower: number | null; users_upper: number | null } | null,
): MetaOverlapRow {
  return {
    id: groupId,
    and: row.and,
    b: groupReach ?? undefined,
    pct: row.pct_sel ?? null,
    pct_com: row.pct_sel ?? null,
    pct_sel: row.pct_com ?? row.pct ?? null,
    error: row.error,
  };
}

const GRAPHIC_COL_W = 180;
const GRAPHIC_COL_H = 88;
/** Blue (selected) circle center X inside the graphic column — shared by header + rows. */
const SELECTED_CIRCLE_CX = 112;
const SELECTED_CIRCLE_R = 34;

function NumberWithSpinner({
  value,
  loading,
  className,
}: {
  value: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="tabular-nums">{value}</span>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-label="Updating" />
      ) : null}
    </span>
  );
}

function MetricValue({
  value,
  hint,
  className,
  loading,
}: {
  value: string;
  hint: string;
  className?: string;
  loading?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className={cn("flex cursor-help items-center justify-center text-[13px] font-medium", className)}>
          <NumberWithSpinner value={value} loading={loading} />
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function SelectedAudienceCircle() {
  const size = SELECTED_CIRCLE_R * 2;
  return (
    <div
      className="relative shrink-0"
      style={{ width: GRAPHIC_COL_W, height: GRAPHIC_COL_H }}
      aria-hidden
    >
      <div
        className="absolute rounded-full bg-[#7EB6F6]"
        style={{
          width: size,
          height: size,
          left: SELECTED_CIRCLE_CX - SELECTED_CIRCLE_R,
          top: GRAPHIC_COL_H / 2 - SELECTED_CIRCLE_R,
        }}
      />
    </div>
  );
}

/** If comparison is this many times selected, sizes are not apple-to-apple — use a rectangle. */
const COMPARISON_BOX_RATIO = 10;

function circleLensArea(r: number, R: number, d: number): number {
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(r, R) ** 2;
  if (d >= r + R) return 0;
  const r2 = r * r;
  const R2 = R * R;
  const d2 = d * d;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d2 + r2 - R2) / (2 * d * r))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d2 + R2 - r2) / (2 * d * R))));
  return (
    r2 * alpha +
    R2 * beta -
    0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)))
  );
}

function distanceForLensArea(r: number, R: number, targetArea: number): number {
  const contained = Math.abs(R - r);
  const separate = r + R;
  const maxArea = Math.PI * Math.min(r, R) ** 2;
  if (targetArea >= maxArea * 0.995) return contained;
  if (targetArea <= 1e-6) return separate;
  let lo = contained;
  let hi = separate;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (circleLensArea(r, R, mid) > targetArea) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function ComparisonOverlapGraphic({
  selectedSize,
  comparisonSize,
  overlapSize,
}: {
  selectedSize: number;
  comparisonSize: number;
  overlapSize: number;
}) {
  const selected = Math.max(selectedSize, 1);
  const comparison = Math.max(comparisonSize, 1);
  const and = Math.max(0, Math.min(overlapSize, selected, comparison));
  const useBox = comparison / selected >= COMPARISON_BOX_RATIO;
  const cy = GRAPHIC_COL_H / 2;
  const cxSel = SELECTED_CIRCLE_CX;

  if (useBox) {
    const r = SELECTED_CIRCLE_R;
    const t = Math.max(0, Math.min(1, Math.log(comparison / selected) / Math.log(100)));
    const rectH = 58 + t * 20;
    const rectW = 88 + t * 44;
    const fracOfSelected = Math.min(1, and / selected);
    const overlapPx = Math.min(rectW, r * 2) * Math.max(0.08, fracOfSelected);
    const rectX = Math.max(4, cxSel - r - (rectW - overlapPx));
    const rectY = (GRAPHIC_COL_H - rectH) / 2;
    return (
      <svg
        width={GRAPHIC_COL_W}
        height={GRAPHIC_COL_H}
        viewBox={`0 0 ${GRAPHIC_COL_W} ${GRAPHIC_COL_H}`}
        className="shrink-0"
        aria-hidden
      >
        <rect x={rectX} y={rectY} width={rectW} height={rectH} rx="2" fill="#F08080" fillOpacity="0.72" />
        <circle cx={cxSel} cy={cy} r={r} fill="#7EB6F6" fillOpacity="0.7" />
      </svg>
    );
  }

  const maxUsers = Math.max(selected, comparison);
  const maxR = SELECTED_CIRCLE_R;
  const minR = 7;
  const rSel = Math.max(minR, maxR * Math.sqrt(selected / maxUsers));
  const rCom = Math.max(minR, maxR * Math.sqrt(comparison / maxUsers));
  const targetArea = Math.PI * Math.min(rSel, rCom) ** 2 * (and / Math.min(selected, comparison));
  const d = distanceForLensArea(rCom, rSel, targetArea);
  const cxCom = Math.max(rCom + 4, cxSel - d);

  return (
    <svg
      width={GRAPHIC_COL_W}
      height={GRAPHIC_COL_H}
      viewBox={`0 0 ${GRAPHIC_COL_W} ${GRAPHIC_COL_H}`}
      className="shrink-0"
      aria-hidden
    >
      <circle cx={cxCom} cy={cy} r={rCom} fill="#F08080" fillOpacity="0.72" />
      <circle cx={cxSel} cy={cy} r={rSel} fill="#7EB6F6" fillOpacity="0.7" />
    </svg>
  );
}

export function InterestResearchAudienceOverlapDialog({
  open,
  onOpenChange,
  organizationId,
  adAccountId,
  filters,
  checkedItems,
  rowEstimates,
}: InterestResearchAudienceOverlapDialogProps) {
  const { t } = useTranslation();
  const overlapRowsMutation = useMetaAdsTargetingOverlapRows();
  const suggestMutation = useMetaAdsTargetingSuggest();
  const [mode, setMode] = useState<OverlapMode>("single");
  const [pool, setPool] = useState<MetaTargetingItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [groupMembers, setGroupMembers] = useState<MetaTargetingItem[]>([]);
  const [comparisons, setComparisons] = useState<MetaTargetingItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [groupSnapshot, setGroupSnapshot] = useState<GroupSnapshot | null>(null);
  const [rowMap, setRowMap] = useState<Record<string, MetaOverlapRow>>({});
  const [seedReach, setSeedReach] = useState<{
    users_lower: number | null;
    users_upper: number | null;
  } | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [loadingScope, setLoadingScope] = useState<"selected" | "comparison" | "both" | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupSearchInput, setGroupSearchInput] = useState("");
  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState("");
  const [relatedItems, setRelatedItems] = useState<MetaTargetingItem[]>([]);
  const reqRef = useRef(0);
  const wasOpenRef = useRef(false);
  const lastSeedKeyRef = useRef("");
  const lastComparisonKeyRef = useRef("");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedGroupSearch(groupSearchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [groupSearchInput]);

  const searchQuery = useMetaAdsTargetingSearch({
    organizationId,
    adAccountId,
    q: debouncedSearch,
    typeFilter: "all",
    enabled: open && debouncedSearch.length >= 2,
  });
  const groupSearchQuery = useMetaAdsTargetingSearch({
    organizationId,
    adAccountId,
    q: debouncedGroupSearch,
    typeFilter: "all",
    enabled: open && mode === "group" && debouncedGroupSearch.length >= 2,
  });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const items = checkedItems.slice(0, 40);
      setMode("single");
      setPool(items);
      setSelectedId(items[0]?.id ?? "");
      setGroupMembers(items.slice(0, GROUP_MEMBER_CAP));
      setComparisons(items.slice(GROUP_MEMBER_CAP));
      setHiddenIds(new Set());
      setGroupSnapshot(null);
      setRowMap({});
      setSeedReach(null);
      setSearchInput("");
      setDebouncedSearch("");
      setGroupSearchInput("");
      setDebouncedGroupSearch("");
      setRelatedItems([]);
      setLoadingScope(null);
      lastSeedKeyRef.current = "";
      lastComparisonKeyRef.current = "";
    }
    wasOpenRef.current = open;
  }, [open, checkedItems]);

  const poolById = useMemo(() => new Map(pool.map((item) => [item.id, item])), [pool]);
  const selectedItem = poolById.get(selectedId) ?? null;
  const groupMemberIds = useMemo(() => new Set(groupMembers.map((item) => item.id)), [groupMembers]);

  const seedItems = useMemo(() => {
    if (mode === "group") return groupMembers.slice(0, GROUP_MEMBER_CAP);
    return selectedItem ? [selectedItem] : [];
  }, [mode, groupMembers, selectedItem]);

  const comparisonItems = useMemo(() => {
    if (mode === "group") {
      return comparisons
        .filter((item) => !groupMemberIds.has(item.id) && !hiddenIds.has(item.id))
        .slice(0, COMPARISON_CAP);
    }
    return pool.filter((item) => item.id !== selectedId && !hiddenIds.has(item.id)).slice(0, COMPARISON_CAP);
  }, [mode, comparisons, groupMemberIds, hiddenIds, pool, selectedId]);

  const seedKey = seedItems.map((item) => item.id).sort().join("+");
  const comparisonKey = comparisonItems.map((item) => item.id).sort().join(",");

  useEffect(() => {
    if (!open || !adAccountId || !seedItems.length) {
      setRelatedItems([]);
      return;
    }
    let cancelled = false;
    void suggestMutation
      .mutateAsync({
        organizationId,
        adAccountId,
        interestList: seedItems.map((item) => item.name),
        items: seedItems.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          path: item.path,
        })),
      })
      .then((res) => {
        if (!cancelled) setRelatedItems(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setRelatedItems([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, adAccountId, organizationId, seedKey]);

  useEffect(() => {
    if (!open || !adAccountId || !seedItems.length) return;
    const fetchItems = comparisonItems;
    const requestId = ++reqRef.current;
    const shouldFetchGroup = Boolean(groupSnapshot && mode === "single" && selectedItem);
    const shouldFetchSeedOnly = fetchItems.length === 0 && !shouldFetchGroup;

    const seedChanged = lastSeedKeyRef.current !== seedKey;
    const comparisonChanged = lastComparisonKeyRef.current !== comparisonKey;
    lastSeedKeyRef.current = seedKey;
    lastComparisonKeyRef.current = comparisonKey;
    const nextScope =
      seedChanged && !comparisonChanged
        ? "selected"
        : !seedChanged && comparisonChanged
          ? "comparison"
          : "both";

    const run = async () => {
      setRowsLoading(true);
      setLoadingScope(nextScope);
      try {
        const next: Record<string, MetaOverlapRow> = {};
        let nextSeed = seedReach;
        const seedPayload = seedItems.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          path: item.path,
        }));
        if (shouldFetchSeedOnly) {
          const res = await overlapRowsMutation.mutateAsync({
            organizationId,
            adAccountId,
            filters,
            seed: seedPayload,
            items: [],
            unionItems: mode === "group",
          });
          if (reqRef.current !== requestId) return;
          nextSeed = res.seed ?? nextSeed;
        } else if (mode === "group") {
          const res = await overlapRowsMutation.mutateAsync({
            organizationId,
            adAccountId,
            filters,
            seed: seedPayload,
            items: fetchItems.map((item) => toSeedItem(item, rowEstimates[item.id])),
            unionItems: true,
          });
          if (reqRef.current !== requestId) return;
          nextSeed = res.seed ?? nextSeed;
          const unionRow = res.rows?.[0];
          if (unionRow) next[COMPARISON_UNION_ID] = { ...unionRow, id: COMPARISON_UNION_ID };
        } else {
          for (let i = 0; i < fetchItems.length; i += 20) {
            const chunk = fetchItems.slice(i, i + 20);
            const res = await overlapRowsMutation.mutateAsync({
              organizationId,
              adAccountId,
              filters,
              seed: seedPayload,
              items: chunk.map((item) => toSeedItem(item, rowEstimates[item.id])),
            });
            if (reqRef.current !== requestId) return;
            nextSeed = res.seed ?? nextSeed;
            for (const row of res.rows ?? []) next[row.id] = row;
          }
        }
        if (groupSnapshot && mode === "single" && selectedItem) {
          const groupRes = await overlapRowsMutation.mutateAsync({
            organizationId,
            adAccountId,
            filters,
            seed: groupSnapshot.members.map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              path: item.path,
            })),
            items: [toSeedItem(selectedItem, rowEstimates[selectedItem.id])],
          });
          if (reqRef.current !== requestId) return;
          const invertedSource = groupRes.rows?.[0];
          if (invertedSource) {
            next[GROUP_COMPARISON_ID] = invertOverlapRow(
              invertedSource,
              GROUP_COMPARISON_ID,
              groupRes.seed ?? groupSnapshot.row.b,
            );
          }
        }
        setSeedReach(nextSeed ?? null);
        setRowMap(next);
      } catch {
        if (reqRef.current === requestId) setRowMap({});
      } finally {
        if (reqRef.current === requestId) {
          setRowsLoading(false);
          setLoadingScope(null);
        }
      }
    };

    void run();
    return () => {
      reqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, adAccountId, organizationId, seedKey, comparisonKey, mode, filters, groupSnapshot != null]);

  const comparisonBlockedIds = useMemo(() => {
    const ids = new Set<string>([...groupMemberIds, selectedId]);
    if (mode === "group") {
      for (const item of comparisons) ids.add(item.id);
    } else {
      for (const id of poolById.keys()) ids.add(id);
    }
    return ids;
  }, [comparisons, groupMemberIds, mode, poolById, selectedId]);

  const searchHits = useMemo(
    () =>
      rankSearchHits(
        debouncedSearch,
        searchQuery.data?.items ?? [],
        relatedItems,
        comparisonBlockedIds,
      ),
    [debouncedSearch, searchQuery.data?.items, relatedItems, comparisonBlockedIds],
  );

  const groupSearchHits = useMemo(
    () =>
      rankSearchHits(
        debouncedGroupSearch,
        groupSearchQuery.data?.items ?? [],
        relatedItems,
        groupMemberIds,
      ),
    [debouncedGroupSearch, groupSearchQuery.data?.items, relatedItems, groupMemberIds],
  );

  const addComparison = (item: MetaTargetingItem) => addComparisons([item]);

  const addGroupMembers = (incoming: MetaTargetingItem[]) => {
    const unique = incoming.filter((item, index) => incoming.findIndex((row) => row.id === item.id) === index);
    let overflow = false;
    setGroupMembers((prev) => {
      const next = [...prev];
      const ids = new Set(next.map((item) => item.id));
      for (const item of unique) {
        if (ids.has(item.id)) continue;
        if (next.length >= GROUP_MEMBER_CAP) {
          overflow = true;
          continue;
        }
        ids.add(item.id);
        next.push(item);
      }
      return next;
    });
    const addedIds = new Set(unique.map((item) => item.id));
    setComparisons((prev) => prev.filter((row) => !addedIds.has(row.id)));
    setGroupSearchInput("");
    setDebouncedGroupSearch("");
    if (overflow) {
      toast.error(
        t("digitalMarketing.metaAds.interestOverlapGroupCap", "Interest Group can include up to {{count}} audiences", {
          count: GROUP_MEMBER_CAP,
        }),
      );
    }
  };

  const addGroupMember = (item: MetaTargetingItem) => addGroupMembers([item]);

  const addComparisons = (incoming: MetaTargetingItem[]) => {
    const unique = incoming.filter((item, index) => incoming.findIndex((row) => row.id === item.id) === index);
    if (mode === "group") {
      let overflow = false;
      setComparisons((prev) => {
        const visible = prev.filter((row) => !groupMemberIds.has(row.id) && !hiddenIds.has(row.id));
        const ids = new Set(prev.map((row) => row.id));
        const next = [...prev];
        for (const item of unique) {
          if (groupMemberIds.has(item.id) || ids.has(item.id)) continue;
          if (visible.length + (next.length - prev.length) >= COMPARISON_CAP) {
            overflow = true;
            continue;
          }
          ids.add(item.id);
          next.push(item);
        }
        return next;
      });
      if (overflow) {
        toast.error(
          t("digitalMarketing.metaAds.interestOverlapComparisonCap", "You can compare up to {{count}} audiences", {
            count: COMPARISON_CAP,
          }),
        );
      }
    } else {
      setPool((prev) => {
        const ids = new Set(prev.map((row) => row.id));
        const extra = unique.filter((item) => !ids.has(item.id));
        return extra.length ? [...prev, ...extra] : prev;
      });
    }
    setHiddenIds((prev) => {
      const next = new Set(prev);
      for (const item of unique) next.delete(item.id);
      return next;
    });
    setSearchInput("");
    setDebouncedSearch("");
  };

  const removeComparison = (id: string) => {
    if (id === GROUP_COMPARISON_ID) {
      setGroupSnapshot(null);
      return;
    }
    if (mode === "group") {
      setComparisons((prev) => prev.filter((row) => row.id !== id));
      return;
    }
    setHiddenIds((prev) => new Set(prev).add(id));
  };

  const removeGroupMember = (id: string) => {
    if (groupMembers.length <= 1) return;
    setGroupMembers((prev) => prev.filter((row) => row.id !== id));
  };

  const selectAudience = (id: string) => {
    if (id === SELECTED_GROUP_VALUE) return;
    setSelectedId(id);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const seedMid = midBound(seedReach?.users_lower ?? null, seedReach?.users_upper ?? null) ?? 0;
  const selectedSizeLabel = formatPeople(
    seedReach?.users_lower ?? null,
    seedReach?.users_upper ?? null,
  );
  const selectedName =
    mode === "group"
      ? t("digitalMarketing.metaAds.interestOverlapInterestGroupN", "Interest Group ({{count}})", {
          count: groupMembers.length,
        })
      : selectedItem?.name ?? "";

  const showGroupComparison = mode === "single" && groupSnapshot != null && !hiddenIds.has(GROUP_COMPARISON_ID);
  const comparisonRows: Array<{
    id: string;
    name: string;
    sizeLower: number | null;
    sizeUpper: number | null;
    item?: MetaTargetingItem;
    items?: MetaTargetingItem[];
    row?: MetaOverlapRow;
  }> =
    mode === "group"
      ? comparisonItems.length
        ? [
            (() => {
              const ov = rowMap[COMPARISON_UNION_ID];
              const size = comparisonPotential(ov);
              return {
                id: COMPARISON_UNION_ID,
                name: comparisonItems.map((item) => item.name).join(", "),
                sizeLower: size.lower,
                sizeUpper: size.upper,
                items: comparisonItems,
                row: ov,
              };
            })(),
          ]
        : []
      : [
          ...(showGroupComparison
            ? [
                {
                  id: GROUP_COMPARISON_ID,
                  name: t("digitalMarketing.metaAds.interestOverlapInterestGroupN", "Interest Group ({{count}})", {
                    count: groupSnapshot.members.length,
                  }),
                  sizeLower: null as number | null,
                  sizeUpper: null as number | null,
                  row: rowMap[GROUP_COMPARISON_ID] ?? groupSnapshot.row,
                },
              ]
            : []),
          ...comparisonItems.map((item) => {
            const ov = rowMap[item.id];
            const size = comparisonPotential(ov, rowEstimates[item.id]);
            return {
              id: item.id,
              name: item.name,
              sizeLower: size.lower,
              sizeUpper: size.upper,
              item,
              row: ov,
            };
          }),
        ];

  const canAnalyzeSingle = pool.length >= 2 && Boolean(selectedItem);
  const canAnalyzeGroup = groupMembers.length >= 2;
  const canAnalyze = mode === "group" ? canAnalyzeGroup : canAnalyzeSingle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,840px)] w-full max-w-[860px] flex-col gap-0 overflow-hidden bg-white p-0 sm:rounded-xl">
      <TooltipProvider delayDuration={200}>
        <DialogHeader className="relative flex min-h-[56px] flex-row items-center px-6 py-3 pr-14 text-left">
          <DialogTitle className="text-[15px] font-semibold text-slate-900">
            {t("digitalMarketing.metaAds.interestOverlapAnalyzeTitle", "Audience Overlap")}
          </DialogTitle>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              const next = value === "group" ? "group" : "single";
              setMode(next);
              if (next === "group") {
                setComparisons((prev) => {
                  if (prev.length > 0) return prev;
                  return pool.filter((item) => !groupMemberIds.has(item.id)).slice(0, COMPARISON_CAP);
                });
              }
            }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <TabsList className="h-8 rounded-md bg-slate-100 p-0.5">
              <TabsTrigger
                value="single"
                className="h-7 rounded px-3 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t("digitalMarketing.metaAds.interestOverlapTabSingle", "Single Interest")}
              </TabsTrigger>
              <TabsTrigger
                value="group"
                className="h-7 rounded px-3 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                disabled={groupMembers.length < 2 && pool.length < 2}
              >
                {t("digitalMarketing.metaAds.interestOverlapTabGroup", "Interest Group")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-4 pt-1">
          <p className="mb-3 text-[13px] text-slate-500">
            {t(
              "digitalMarketing.metaAds.interestOverlapChooseHint",
              "Choose an audience and compare the overlap with other audiences.",
            )}
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
              <p className="text-[13px] font-semibold text-slate-900">
                {t("digitalMarketing.metaAds.interestOverlapSelectedAudience", "Selected Audience")}
              </p>
              {mode === "group" ? null : (
                <Select value={selectedId} onValueChange={selectAudience}>
                  <SelectTrigger className="h-8 w-auto min-w-[180px] max-w-[280px] border-slate-200 bg-slate-50 text-xs">
                    <SelectValue
                      placeholder={t("digitalMarketing.metaAds.interestOverlapSelectAudience", "Select audience")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {pool.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className={mode === "group" ? OVERLAP_GRID_GROUP : OVERLAP_GRID_SINGLE}>
              <div className="min-w-0">
                {mode === "group" ? (
                  <div className="mb-1 flex flex-col items-start gap-1.5">
                    {groupMembers.map((item) => (
                      <AudienceChip
                        key={item.id}
                        name={item.name}
                        disabled={groupMembers.length <= 1}
                        onRemove={() => removeGroupMember(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="truncate text-[13px] font-medium text-slate-800">{selectedName}</p>
                )}
                <p className="text-[13px] font-medium text-[#3B82F6]">
                  <NumberWithSpinner
                    value={selectedSizeLabel}
                    loading={loadingScope === "selected" || loadingScope === "both"}
                  />
                </p>
              </div>
              <div className="flex justify-center sm:justify-start">
                <SelectedAudienceCircle />
              </div>
              <span className="hidden sm:block" />
              <span className="hidden sm:block" />
              <span className="hidden sm:block" />
              {mode === "group" ? null : <span className="hidden sm:block" />}
            </div>
            {mode === "group" ? (
              <CompareSearchBar
                label={t("digitalMarketing.metaAds.interestOverlapCompareAnother", "Compare Another Interest")}
              >
                <InterestResearchOverlapSearchField
                  organizationId={organizationId}
                  adAccountId={adAccountId}
                  query={groupSearchInput}
                  onQueryChange={setGroupSearchInput}
                  hits={groupSearchHits}
                  searching={groupSearchQuery.isFetching || suggestMutation.isPending}
                  onPick={addGroupMember}
                  onPickMany={addGroupMembers}
                  blockedIds={groupMemberIds}
                />
              </CompareSearchBar>
            ) : null}
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200">
            <div
              className={cn(
                "hidden items-end gap-2 border-b border-slate-200 px-4 py-2.5 sm:grid",
                mode === "group"
                  ? "grid-cols-[minmax(0,1.15fr)_180px_88px_120px_120px]"
                  : "grid-cols-[minmax(0,1.2fr)_180px_88px_120px_120px_36px]",
              )}
            >
              <p className="text-[13px] font-semibold text-slate-900">
                {t("digitalMarketing.metaAds.interestOverlapComparisonAudiences", "Comparison Audiences")}
              </p>
              <span />
              <p className="text-center text-[11px] font-medium text-slate-600">
                {t("digitalMarketing.metaAds.interestOverlapPeople", "Overlap")}
              </p>
              <p className="text-center text-[11px] font-medium leading-tight text-slate-600">
                {t("digitalMarketing.metaAds.interestOverlapPctComLong", "% Overlap of Comparison Audience")}
              </p>
              <p className="text-center text-[11px] font-medium leading-tight text-slate-600">
                {t("digitalMarketing.metaAds.interestOverlapPctSelLong", "% Overlap of Selected Audience")}
              </p>
              <span />
            </div>
            <p className="px-4 py-2 text-[13px] font-semibold text-slate-900 sm:hidden">
              {t("digitalMarketing.metaAds.interestOverlapComparisonAudiences", "Comparison Audiences")}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!canAnalyze ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {mode === "group"
                    ? t("digitalMarketing.metaAds.interestOverlapNeedGroup", "Interest Group needs at least two members")
                    : t("digitalMarketing.metaAds.interestOverlapNeedTwoPlus", "Select at least two items to compare")}
                </p>
              ) : comparisonRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("digitalMarketing.metaAds.interestOverlapNoComparisons", "Add a comparison interest below")}
                </p>
              ) : (
                comparisonRows.map((row) => {
                  const ov = row.row;
                  const andLower = ov?.and.users_lower ?? null;
                  const andUpper = ov?.and.users_upper ?? null;
                  const andMid = midBound(andLower, andUpper) ?? 0;
                  const pctCom = ov?.pct_com ?? ov?.pct ?? null;
                  const pctSel = ov?.pct_sel ?? null;
                  const potential = comparisonPotential(
                    ov,
                    row.item ? rowEstimates[row.item.id] : undefined,
                  );
                  const sizeB = midBound(potential.lower, potential.upper) ?? andMid;
                  const sizeA = seedMid > 0 ? seedMid : andMid;
                  const loadingRow = rowsLoading && !ov;
                  const numbersUpdating =
                    loadingScope === "comparison" || loadingScope === "both";
                  const comparisonSizeLabel = formatPeople(potential.lower, potential.upper);
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        mode === "group" ? OVERLAP_GRID_GROUP : OVERLAP_GRID_SINGLE,
                        mode === "single" && "border-t border-slate-100 first:border-t-0",
                      )}
                    >
                      <div className="min-w-0">
                        {mode === "group" && row.items?.length ? (
                          <div className="mb-1 flex flex-col items-start gap-1.5">
                            {row.items.map((item) => (
                              <AudienceChip
                                key={item.id}
                                name={item.name}
                                onRemove={() => removeComparison(item.id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="truncate text-[13px] font-medium text-[#E11D48]">
                            {row.name}
                          </p>
                        )}
                        <p className="text-[13px] font-medium text-[#E11D48]">
                          <NumberWithSpinner value={comparisonSizeLabel} loading={numbersUpdating} />
                        </p>
                        {ov?.error ? <p className="text-[11px] text-destructive">{ov.error}</p> : null}
                      </div>
                      <div className="flex justify-center">
                        {loadingRow ? (
                          <Skeleton className="h-[58px] w-[160px]" />
                        ) : (
                          <ComparisonOverlapGraphic
                            selectedSize={Math.max(sizeA, 1)}
                            comparisonSize={Math.max(sizeB, 1)}
                            overlapSize={Math.max(andMid, 0)}
                          />
                        )}
                      </div>
                      {loadingRow ? (
                        <p className="flex items-center justify-center text-[13px] text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </p>
                      ) : (
                        <MetricValue
                          className="text-[#3B82F6]"
                          loading={numbersUpdating}
                          value={formatPeople(andLower, andUpper)}
                          hint={t(
                            "digitalMarketing.metaAds.interestOverlapPeopleValueHint",
                            "{{overlap}} people are in both {{selected}} ({{selectedSize}}) and {{comparison}} ({{comparisonSize}}). This is Potential Reach of selected AND comparison with the current filters.",
                            {
                              overlap: formatPeople(andLower, andUpper),
                              selected: selectedName,
                              selectedSize: selectedSizeLabel,
                              comparison: row.name,
                              comparisonSize: comparisonSizeLabel,
                            },
                          )}
                        />
                      )}
                      {loadingRow ? (
                        <p className="flex items-center justify-center text-[13px] text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </p>
                      ) : (
                        <MetricValue
                          className="text-[#E11D48]"
                          loading={numbersUpdating}
                          value={formatPct(pctCom)}
                          hint={t(
                            "digitalMarketing.metaAds.interestOverlapPctComValueHint",
                            "{{pct}} of {{comparison}} also matches {{selected}}. {{overlap}} ÷ {{comparisonSize}}.",
                            {
                              pct: formatPct(pctCom),
                              comparison: row.name,
                              selected: selectedName,
                              overlap: formatPeople(andLower, andUpper),
                              comparisonSize: comparisonSizeLabel,
                            },
                          )}
                        />
                      )}
                      {loadingRow ? (
                        <p className="flex items-center justify-center text-[13px] text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </p>
                      ) : (
                        <MetricValue
                          className="text-[#3B82F6]"
                          loading={numbersUpdating}
                          value={formatPct(pctSel)}
                          hint={t(
                            "digitalMarketing.metaAds.interestOverlapPctSelValueHint",
                            "{{pct}} of {{selected}} also matches {{comparison}}. {{overlap}} ÷ {{selectedSize}}.",
                            {
                              pct: formatPct(pctSel),
                              selected: selectedName,
                              comparison: row.name,
                              overlap: formatPeople(andLower, andUpper),
                              selectedSize: selectedSizeLabel,
                            },
                          )}
                        />
                      )}
                      {mode === "group" ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-700"
                          title={t("digitalMarketing.metaAds.interestOverlapRemoveComparison", "Remove")}
                          onClick={() => removeComparison(row.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <CompareSearchBar
              label={t("digitalMarketing.metaAds.interestOverlapCompareAnother", "Compare Another Interest")}
            >
              <InterestResearchOverlapSearchField
                organizationId={organizationId}
                adAccountId={adAccountId}
                query={searchInput}
                onQueryChange={setSearchInput}
                hits={searchHits}
                searching={searchQuery.isFetching || suggestMutation.isPending}
                onPick={addComparison}
                onPickMany={addComparisons}
                blockedIds={comparisonBlockedIds}
              />
            </CompareSearchBar>
          </div>
        </div>
      </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
