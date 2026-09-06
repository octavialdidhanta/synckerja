import type { PosActivityProductGroup } from "../lib/posActivityTypes";
import { PosActivityProductRow } from "./PosActivityProductRow";

type Props = {
  group: PosActivityProductGroup;
};

export function PosActivityProductGroupBlock({ group }: Props) {
  return (
    <div className="px-0 pt-0">
      <div className="relative flex items-center justify-center border-b border-slate-200 bg-slate-50/80 py-2.5">
        <span className="relative px-3 text-sm font-medium text-slate-700">
          {group.salesTypeName}
        </span>
      </div>
      <ul className="divide-y divide-slate-200">
        {group.lines.map((line) => (
          <PosActivityProductRow key={line.key} line={line} badge={group.badge} />
        ))}
      </ul>
    </div>
  );
}
