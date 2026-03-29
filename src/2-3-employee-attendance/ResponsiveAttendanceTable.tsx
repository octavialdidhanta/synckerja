
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { AttendanceTable } from "./AttendanceTable";

interface ResponsiveAttendanceTableProps {
  searchTerm: string;
  status: string;
  dateRange?: { from?: Date; to?: Date };
}

export const ResponsiveAttendanceTable = ({
  searchTerm,
  status,
  dateRange,
}: ResponsiveAttendanceTableProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const content = el.firstElementChild;
    if (!(content instanceof HTMLElement)) return;

    const lenis = new Lenis({
      wrapper: el,
      content,
      autoRaf: true,
      smoothWheel: true,
      // Lower lerp = smoother, more “weighted” inertia (still responsive)
      lerp: 0.065,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.15,
      allowNestedScroll: true,
      overscroll: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div
          ref={scrollRef}
          className="attendance-table-main-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto rounded-md seamless-scroll nested-scroll-touch-chain"
        >
          <AttendanceTable
            searchTerm={searchTerm}
            status={status}
            dateRange={dateRange}
          />
        </div>
      </div>
    </div>
  );
};
