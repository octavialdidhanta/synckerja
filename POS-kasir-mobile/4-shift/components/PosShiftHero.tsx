import { MonitorSmartphone } from "lucide-react";

/** Cash-register style hero for Shift left pane. */
export function PosShiftHero() {
  return (
    <div className="flex flex-col items-center px-4 py-4 sm:py-6">
      <div className="relative flex h-20 w-24 items-end justify-center text-slate-300 sm:h-24 sm:w-28">
        <div className="absolute bottom-0 h-9 w-20 rounded-sm border-2 border-slate-300 bg-slate-50 sm:h-10 sm:w-24" />
        <div className="absolute bottom-7 flex h-12 w-14 flex-col items-center rounded-t-md border-2 border-slate-300 bg-white sm:bottom-8 sm:h-14 sm:w-16">
          <MonitorSmartphone className="mt-1.5 h-5 w-5 sm:mt-2 sm:h-6 sm:w-6" aria-hidden />
          <span className="mt-0.5 text-[10px] font-bold tracking-wide text-slate-400 sm:mt-1">
            Rp
          </span>
        </div>
      </div>
    </div>
  );
}
