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

export function IngredientImportExportMenu() {
  const { t } = useAppTranslation();
  const { toast } = useToast();

  const handleStub = () => {
    toast({
      title: t("ingredient.library.importExportSoon", "Import / Export is coming soon."),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          {t("ingredient.library.importExport", "Import / Export")}
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleStub}>
          {t("ingredient.library.importIngredients", "Import Ingredients")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleStub}>
          {t("ingredient.library.exportIngredients", "Export Ingredients")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
