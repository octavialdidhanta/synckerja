import { MonitorSmartphone } from "lucide-react";

/** Cash-register style hero for Shift left pane. */
export function PosShiftHero() {
  return (
    <div className="flex flex-col items-center px-4 py-6">
      <div className="relative flex h-24 w-28 items-end justify-center text-slate-300">
        <div className="absolute bottom-0 h-10 w-24 rounded-sm border-2 border-slate-300 bg-slate-50" />
        <div className="absolute bottom-8 flex h-14 w-16 flex-col items-center rounded-t-md border-2 border-slate-300 bg-white">
          <MonitorSmartphone className="mt-2 h-6 w-6" aria-hidden />
          <span className="mt-1 text-[10px] font-bold tracking-wide text-slate-400">Rp</span>
        </div>
      </div>
    </div>
  );
}
