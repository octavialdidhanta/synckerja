import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type CreateIngredientMenuProps = {
  disabled?: boolean;
  onCreateRaw: () => void;
  onCreateSemi: () => void;
};

export function CreateIngredientMenu({ disabled, onCreateRaw, onCreateSemi }: CreateIngredientMenuProps) {
  const { t } = useAppTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" disabled={disabled}>
          {t("ingredient.library.createButton", "Create Ingredient")}
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onCreateSemi}>
          {t("ingredient.library.semiFinished", "Semi-Finished Ingredient")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCreateRaw}>
          {t("ingredient.library.rawIngredient", "Raw Ingredient")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
