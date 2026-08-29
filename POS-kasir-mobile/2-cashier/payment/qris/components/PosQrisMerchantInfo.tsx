type Props = {
  outletName?: string | null;
  outletAddress?: string | null;
};

export function PosQrisMerchantInfo({ outletName, outletAddress }: Props) {
  const name = outletName?.trim();
  const address = outletAddress?.trim();
  if (!name && !address) return null;

  return (
    <div className="px-6 text-center">
      {name ? (
        <p className="text-sm font-semibold leading-snug text-slate-900">{name}</p>
      ) : null}
      {address ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{address}</p>
      ) : null}
    </div>
  );
}
