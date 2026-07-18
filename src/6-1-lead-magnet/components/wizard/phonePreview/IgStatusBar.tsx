/** Shared IG status bar — padded so time/battery clear the bezel & notch. */
export function IgStatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold leading-none text-white">
      <span>11:41</span>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="inline-flex h-2.5 items-end gap-px">
          <span className="h-1 w-0.5 rounded-[0.5px] bg-white" />
          <span className="h-1.5 w-0.5 rounded-[0.5px] bg-white" />
          <span className="h-2 w-0.5 rounded-[0.5px] bg-white" />
          <span className="h-2.5 w-0.5 rounded-[0.5px] bg-white/40" />
        </span>
        <svg viewBox="0 0 16 12" className="h-2.5 w-3.5 fill-white" aria-hidden>
          <path d="M8 2.5c2.1 0 4 .8 5.5 2.2L12.3 6A5.3 5.3 0 0 0 8 4.5 5.3 5.3 0 0 0 3.7 6L2.5 4.7C4 3.3 5.9 2.5 8 2.5Zm0 3c1.1 0 2.1.4 2.9 1.1L9.7 7.8A2.4 2.4 0 0 0 8 7.2c-.7 0-1.3.2-1.7.6L5.1 6.6C5.9 5.9 6.9 5.5 8 5.5ZM8 8.5c.7 0 1.2.5 1.2 1.2S8.7 11 8 11s-1.2-.5-1.2-1.3.5-1.2 1.2-1.2Z" />
        </svg>
        <span className="relative h-2.5 w-5 rounded-[3px] border border-white/90">
          <span className="absolute inset-[1.5px] right-[3px] rounded-[1px] bg-white/90" />
          <span className="absolute -right-[2px] top-1/2 h-1.5 w-0.5 -translate-y-1/2 rounded-r-[1px] bg-white/90" />
        </span>
      </div>
    </div>
  );
}
