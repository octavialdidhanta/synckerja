import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";

/** Header brand konsisten untuk halaman modul mobile (bawah app shell). */
export function MobileModuleBrandBar() {
  return (
    <div className="flex shrink-0 items-center justify-center border-b border-border/60 bg-[hsl(var(--brand-white))] px-4 py-3">
      <SynckerjaBrandMark size="sm" />
    </div>
  );
}
