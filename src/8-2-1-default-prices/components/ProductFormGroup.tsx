import type { ReactNode } from "react";
import { FieldInfoTip } from "./FieldInfoTip";

export function ProductFormGroup({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {tip ? <FieldInfoTip text={tip} /> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
