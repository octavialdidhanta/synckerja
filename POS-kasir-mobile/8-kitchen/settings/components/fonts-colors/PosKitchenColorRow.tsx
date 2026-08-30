import { useEffect, useState } from "react";
import { normalizeKitchenHex } from "../../lib/parseKitchenThemePrefs";

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
};

/**
 * Label + hex text field + native color swatch.
 */
export function PosKitchenColorRow({ label, value, onChange }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const hex = normalizeKitchenHex(draft);
            if (hex) {
              setDraft(hex);
              onChange(hex);
            } else {
              setDraft(value);
            }
          }}
          className="w-[7.5rem] rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          aria-label={label}
        />
        <label className="relative h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200 shadow-sm">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: normalizeKitchenHex(value) ?? "#cccccc" }}
            aria-hidden
          />
          <input
            type="color"
            value={normalizeKitchenHex(value) ?? "#cccccc"}
            onChange={(e) => {
              const hex = e.target.value.toLowerCase();
              setDraft(hex);
              onChange(hex);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} color`}
          />
        </label>
      </div>
    </div>
  );
}
