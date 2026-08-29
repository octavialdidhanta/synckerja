import { ingredientInitials } from "@/8-2-3-ingredient/library/lib/ingredientInitials";

type Props = {
  name: string;
};

/** Two-letter avatar matching BO Ingredient Library initials. */
export function PosInventoryRowAvatar({ name }: Props) {
  const initials = ingredientInitials(name).toUpperCase() || "—";

  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs font-semibold text-slate-600"
      aria-hidden
    >
      {initials}
    </span>
  );
}
