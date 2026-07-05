import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";

type FlowNodeContextMenuProps = {
  nodeId: string;
  hasStepsBelow: boolean;
  onCopyBlock?: (nodeId: string) => void;
  onCopyBlockAndBelow?: (nodeId: string) => void;
  onDeleteBlock?: (nodeId: string) => void;
  onDeleteBelow?: (nodeId: string) => void;
  className?: string;
};

function stopCanvasEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function FlowNodeContextMenu({
  nodeId,
  hasStepsBelow,
  onCopyBlock,
  onCopyBlockAndBelow,
  onDeleteBlock,
  onDeleteBelow,
  className,
}: FlowNodeContextMenuProps) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBelowOpen, setDeleteBelowOpen] = useState(false);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "nodrag nopan nowheel flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-white/20",
              className,
            )}
            aria-label={t("omnichannel.automationFlow.editor.blockMenu.open")}
            onPointerDown={stopCanvasEvent}
            onClick={stopCanvasEvent}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => onCopyBlock?.(nodeId)}>
            {t("omnichannel.automationFlow.editor.blockMenu.copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopyBlockAndBelow?.(nodeId)}>
            {t("omnichannel.automationFlow.editor.blockMenu.copyAllBelow")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            {t("omnichannel.automationFlow.editor.blockMenu.deleteBlock")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasStepsBelow}
            className="text-destructive focus:text-destructive disabled:opacity-50"
            onClick={() => hasStepsBelow && setDeleteBelowOpen(true)}
          >
            {t("omnichannel.automationFlow.editor.blockMenu.deleteAllBelow")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("omnichannel.automationFlow.editor.blockMenu.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("omnichannel.automationFlow.editor.blockMenu.deleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDeleteBlock?.(nodeId);
                setDeleteOpen(false);
              }}
            >
              {t("omnichannel.automationFlow.editor.blockMenu.deleteBlock")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBelowOpen} onOpenChange={setDeleteBelowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("omnichannel.automationFlow.editor.blockMenu.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("omnichannel.automationFlow.editor.blockMenu.deleteAllBelowConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDeleteBelow?.(nodeId);
                setDeleteBelowOpen(false);
              }}
            >
              {t("omnichannel.automationFlow.editor.blockMenu.deleteAllBelow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
