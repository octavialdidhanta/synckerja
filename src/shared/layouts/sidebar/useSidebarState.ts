import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "@/shared/components/ui/sidebar";

const MAIN_SIDEBAR_DELAY = 200;
const SUB_SIDEBAR_DELAY = 100;

export function useSidebarState() {
  const { setOpen } = useSidebar();
  const [activeSubSidebar, setActiveSubSidebar] = useState<string | null>(null);

  const timeoutsRef = useRef<{
    mainSidebar: ReturnType<typeof setTimeout> | null;
    subSidebar: ReturnType<typeof setTimeout> | null;
  }>({
    mainSidebar: null,
    subSidebar: null,
  });

  const clearTimeouts = useCallback(() => {
    if (timeoutsRef.current.mainSidebar) {
      clearTimeout(timeoutsRef.current.mainSidebar);
      timeoutsRef.current.mainSidebar = null;
    }
    if (timeoutsRef.current.subSidebar) {
      clearTimeout(timeoutsRef.current.subSidebar);
      timeoutsRef.current.subSidebar = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimeouts();
    setOpen(true);
  }, [setOpen, clearTimeouts]);

  const handleMouseLeave = useCallback(() => {
    clearTimeouts();

    timeoutsRef.current.mainSidebar = setTimeout(() => {
      setOpen(false);
    }, MAIN_SIDEBAR_DELAY);

    timeoutsRef.current.subSidebar = setTimeout(() => {
      setActiveSubSidebar(null);
    }, SUB_SIDEBAR_DELAY);
  }, [setOpen, clearTimeouts]);

  const handleMenuItemHover = useCallback(
    (itemId: string, hasSubSidebar: boolean) => {
      clearTimeouts();

      if (hasSubSidebar) {
        timeoutsRef.current.subSidebar = setTimeout(() => {
          setActiveSubSidebar(itemId);
        }, SUB_SIDEBAR_DELAY);
      } else {
        setActiveSubSidebar(null);
      }
    },
    [clearTimeouts],
  );

  const handleSubSidebarMouseEnter = useCallback(() => {
    clearTimeouts();
    setOpen(true);
  }, [clearTimeouts, setOpen]);

  const handleSubSidebarMouseLeave = useCallback(() => {
    clearTimeouts();

    timeoutsRef.current.subSidebar = setTimeout(() => {
      setActiveSubSidebar(null);
    }, SUB_SIDEBAR_DELAY);

    timeoutsRef.current.mainSidebar = setTimeout(() => {
      setOpen(false);
    }, MAIN_SIDEBAR_DELAY);
  }, [clearTimeouts, setOpen]);

  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

  return {
    activeSubSidebar,
    handleMouseEnter,
    handleMouseLeave,
    handleMenuItemHover,
    handleSubSidebarMouseEnter,
    handleSubSidebarMouseLeave,
  };
}
