import { useMemo, useState } from "react";
import { MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import { usePosOutlets } from "../hooks/usePosOutlets";
import { useOutletQuota } from "../hooks/useOutletQuota";
import type { PosOutlet } from "../types";
import { formatOutletCityLine, formatOutletPhone } from "../types";
import { OutletForm } from "./OutletForm";
import { OutletTrialBanner } from "./OutletTrialBanner";

const GOBIZ_ALL = "all";
const GOBIZ_LINKED = "linked";
const GOBIZ_NOT_LINKED = "not_linked";

export function OutletsListManager() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = usePosOutlets();
  const quota = useOutletQuota();
  const [query, setQuery] = useState("");
  const [gobizFilter, setGobizFilter] = useState(GOBIZ_ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PosOutlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PosOutlet | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (gobizFilter === GOBIZ_LINKED) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, gobizFilter]);

  const openCreate = () => {
    if (!quota.canCreate) {
      toast({
        title: quota.isTrial
          ? t(
              "outlets.trialBanner",
              "Add Outlet is not available for trial accounts. Your account is currently in the trial period. To add more outlets, please upgrade to a paid subscription package.",
            )
          : t("outlets.quotaReached", "Upgrade the POS add-on to add more outlets."),
        variant: "destructive",
      });
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: PosOutlet) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget);
    } catch {
      toast({
        title: t("outlets.deleteFailed", "Could not delete outlet."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGobizStub = () => {
    toast({
      title: t("outlets.gobizUnavailable", "GoBiz linking is not available yet."),
    });
  };

  if (formOpen) {
    return (
      <OutletForm
        outlet={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {quota.isTrial && !bannerDismissed ? (
        <OutletTrialBanner onDismiss={() => setBannerDismissed(true)} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t("outlets.pageTitle", "Outlet")}</h2>
          <span className="rounded-md border px-2 py-1 text-sm text-muted-foreground">
            {t("outlets.countLabel", "Outlet: {{count}}", { count: rows.length })}
          </span>
        </div>
        <Button type="button" onClick={openCreate} disabled={!quota.canCreate}>
          {t("outlets.createButton", "Create Outlet")}
        </Button>
      </div>

      {!quota.isTrial && !quota.canCreate ? (
        <p className="text-sm text-muted-foreground">
          {t("outlets.quotaReached", "Upgrade the POS add-on to add more outlets.")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("outlets.search", "Search")}
            className="pr-9"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Select value={gobizFilter} onValueChange={setGobizFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GOBIZ_ALL}>{t("outlets.gobizAll", "All Gobiz Status")}</SelectItem>
            <SelectItem value={GOBIZ_LINKED}>{t("outlets.gobizLinked", "Linked")}</SelectItem>
            <SelectItem value={GOBIZ_NOT_LINKED}>{t("outlets.gobizNotLinked", "Not Linked")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("outlets.columnName", "Outlet Name")}</TableHead>
              <TableHead>{t("outlets.columnAddress", "Address")}</TableHead>
              <TableHead className="w-[140px]">{t("outlets.columnPhone", "Phone")}</TableHead>
              <TableHead className="w-[140px]">{t("outlets.columnGobiz", "GoBiz Linking")}</TableHead>
              <TableHead className="w-[160px]">{t("outlets.columnAction", "Action")}</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || quota.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t("outlets.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t("outlets.empty", "No outlets yet.")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const cityLine = formatOutletCityLine(row);
                const canDelete = !row.is_default && rows.length > 1;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="space-y-1">
                        {row.is_active ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("outlets.statusActive", "Active")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("outlets.statusInactive", "Inactive")}</Badge>
                        )}
                        <button
                          type="button"
                          className="block text-left font-medium text-foreground hover:underline"
                          onClick={() => openEdit(row)}
                        >
                          {row.name}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p>{row.address || "—"}</p>
                      {cityLine ? <p className="text-sm text-muted-foreground">{cityLine}</p> : null}
                    </TableCell>
                    <TableCell>{formatOutletPhone(row.phone)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t("outlets.gobizNotLinked", "Not Linked")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" className="border-primary text-primary" onClick={handleGobizStub}>
                        {t("outlets.linkGobiz", "Link to GoBiz")}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("common.edit", "Edit")}
                          </DropdownMenuItem>
                          {canDelete ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("common.delete", "Delete")}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("outlets.deleteTitle", "Delete outlet?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("outlets.deleteBody", "Delete {{name}}?", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
