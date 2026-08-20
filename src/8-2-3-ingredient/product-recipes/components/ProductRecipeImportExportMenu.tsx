import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function ProductRecipeImportExportMenu() {
  const { t } = useAppTranslation();
  const { toast } = useToast();

  const handleStub = () => {
    toast({
      title: t("ingredient.productRecipe.importExportSoon", "Import / Export is coming soon."),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          {t("ingredient.productRecipe.importExport", "Import / Export")}
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleStub}>
          {t("ingredient.productRecipe.importRecipes", "Import Recipes")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleStub}>
          {t("ingredient.productRecipe.exportRecipes", "Export Recipes")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
