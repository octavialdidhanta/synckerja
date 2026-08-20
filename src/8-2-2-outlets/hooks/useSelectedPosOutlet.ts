import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { defaultPosOutletId, POS_OUTLET_FILTER_ALL } from "../lib/assignedOutlets";
import { usePosOutlets } from "./usePosOutlets";

export type UseSelectedPosOutletOptions = {
  allowAll?: boolean;
};

export function useSelectedPosOutlet(enabled = true, options: UseSelectedPosOutletOptions = {}) {
  const allowAll = options.allowAll === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const { rows, isLoading } = usePosOutlets();
  const defaultOutletId = defaultPosOutletId(rows);
  const outletFromUrl = searchParams.get("outlet");
  const urlMatchesOutlet = Boolean(outletFromUrl && rows.some((row) => row.id === outletFromUrl));
  const selectedOutletId = urlMatchesOutlet
    ? outletFromUrl!
    : allowAll
      ? outletFromUrl === POS_OUTLET_FILTER_ALL || !outletFromUrl || !isLoading
        ? POS_OUTLET_FILTER_ALL
        : outletFromUrl
      : (defaultOutletId ?? "");
  const selectedOutletName =
    selectedOutletId === POS_OUTLET_FILTER_ALL
      ? ""
      : (rows.find((row) => row.id === selectedOutletId)?.name ?? "");

  useEffect(() => {
    if (!enabled || isLoading) return;
    if (urlMatchesOutlet) return;
    if (allowAll) {
      if (outletFromUrl === POS_OUTLET_FILTER_ALL) return;
      const next = new URLSearchParams(searchParams);
      next.set("outlet", POS_OUTLET_FILTER_ALL);
      setSearchParams(next, { replace: true });
      return;
    }
    if (!defaultOutletId) return;
    const next = new URLSearchParams(searchParams);
    next.set("outlet", defaultOutletId);
    setSearchParams(next, { replace: true });
  }, [
    allowAll,
    defaultOutletId,
    enabled,
    isLoading,
    outletFromUrl,
    searchParams,
    setSearchParams,
    urlMatchesOutlet,
  ]);

  const setSelectedOutletId = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("outlet", id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return {
    selectedOutletId,
    selectedOutletName,
    setSelectedOutletId,
    outlets: rows,
    isLoading,
  };
}
