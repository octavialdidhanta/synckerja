import { RotateCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type Props = {
  onRotate: () => void;
  className?: string;
};

/** Floating rotate control; stops pointer events from starting drag / opening edit. */
export function TableMapRotateControl({ onRotate, className }: Props) {
  const { t } = useAppTranslation();
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={cn(
        "h-7 w-7 rounded-full border border-slate-200 shadow-md",
        className,
      )}
      aria-label={t("tableManagement.map.rotate", "Rotate")}
      title={t("tableManagement.map.rotate", "Rotate")}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onRotate();
      }}
    >
      <RotateCw className="h-3.5 w-3.5" />
    </Button>
  );
}
