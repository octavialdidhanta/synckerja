import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { cn } from "@/shared/lib/utils";

type Props = {
  outletName: string;
  email?: string | null;
  subtitle?: string | null;
  /** Outlet street address shown under org name on the settings card. */
  address?: string | null;
  logoUrl?: string | null;
  className?: string;
};

export function PosSettingsProfileCard({
  outletName,
  email,
  subtitle,
  address,
  logoUrl,
  className,
}: Props) {
  const trimmedAddress = address?.trim() || "";

  return (
    <div className={cn("flex flex-col items-center gap-2 border-b border-slate-200 px-4 py-5", className)}>
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary p-2">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <SynckerjaBrandMark size="sm" className="max-h-10 brightness-0 invert" />
        )}
      </div>
      <p className="text-center text-base font-bold text-slate-900">{outletName}</p>
      {email ? (
        <p className="max-w-full break-all text-center text-xs text-slate-500">{email}</p>
      ) : null}
      {subtitle ? (
        <p className="text-center text-xs text-slate-400">{subtitle}</p>
      ) : null}
      {trimmedAddress ? (
        <p className="max-w-full whitespace-pre-wrap break-words text-center text-xs leading-snug text-slate-500">
          {trimmedAddress}
        </p>
      ) : null}
    </div>
  );
}
