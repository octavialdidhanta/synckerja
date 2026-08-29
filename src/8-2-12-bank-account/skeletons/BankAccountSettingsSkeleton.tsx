export function BankAccountSettingsSkeleton() {
  return (
    <div className="space-y-4 px-1 py-2" aria-hidden>
      <div className="flex justify-end gap-2">
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-16 animate-pulse rounded-md border border-border bg-muted/40" />
        <div className="h-16 animate-pulse rounded-md border border-border bg-muted/40" />
      </div>
    </div>
  );
}
