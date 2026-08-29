import type { PosActivityProductGroup } from "../lib/posActivityTypes";
import { PosActivityProductRow } from "./PosActivityProductRow";

type Props = {
  group: PosActivityProductGroup;
};

export function PosActivityProductGroupBlock({ group }: Props) {
  return (
    <div className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
      <div className="relative mb-1 flex items-center justify-center py-2">
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" aria-hidden />
        <span className="relative bg-white px-3 text-sm font-medium text-slate-700">
          {group.salesTypeName}
        </span>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {group.lines.map((line) => (
          <PosActivityProductRow key={line.key} line={line} badge={group.badge} />
        ))}
      </ul>
    </div>
  );
}
