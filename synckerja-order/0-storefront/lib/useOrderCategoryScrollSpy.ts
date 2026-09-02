import { useEffect, useRef, type RefObject } from "react";

const SECTION_ID_PREFIX = "order-cat-";
/** Sticky tab bar + breathing room — section whose top is at/above this line is "active". */
const SPY_TOP_OFFSET_PX = 56;

export function orderCategorySectionId(categoryId: string): string {
  return `${SECTION_ID_PREFIX}${categoryId}`;
}

type Args = {
  scrollRootRef: RefObject<HTMLElement | null>;
  categoryIds: string[];
  enabled: boolean;
  activeId: string;
  onActiveId: (id: string) => void;
  /** While `Date.now() < value`, ignore scroll updates (programmatic tab scroll). */
  suppressUntilRef: RefObject<number>;
};

/** Updates active category tab as the catalog scroll container moves past section headers. */
export function useOrderCategoryScrollSpy({
  scrollRootRef,
  categoryIds,
  enabled,
  activeId,
  onActiveId,
  suppressUntilRef,
}: Args) {
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const onActiveIdRef = useRef(onActiveId);
  onActiveIdRef.current = onActiveId;
  const idsKey = categoryIds.join("\0");

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || !enabled || categoryIds.length === 0) return;

    const resolveActive = () => {
      if (Date.now() < suppressUntilRef.current) return;

      const rootTop = root.getBoundingClientRect().top;
      const marker = rootTop + SPY_TOP_OFFSET_PX;
      let next = categoryIds[0] ?? "";

      for (const id of categoryIds) {
        const el = document.getElementById(orderCategorySectionId(id));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= marker + 4) {
          next = id;
        }
      }

      if (next && next !== activeIdRef.current) {
        onActiveIdRef.current(next);
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        resolveActive();
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    resolveActive();

    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [scrollRootRef, enabled, idsKey, categoryIds, suppressUntilRef]);
}
