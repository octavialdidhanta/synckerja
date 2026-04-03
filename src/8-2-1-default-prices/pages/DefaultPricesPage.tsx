import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useDefaultPrices } from "../hooks/useDefaultPrices";
import { DefaultPricesTable, DefaultPriceFormDialog, SopWorkflowModal } from "../components";
import { DefaultPricesModuleShell } from "../layout/DefaultPricesModuleShell";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";

export default function DefaultPricesPage() {
  const [activeTab, setActiveTab] = useState("default-prices");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefaultPriceRow | null>(null);
  const [sopModalRow, setSopModalRow] = useState<DefaultPriceRow | null>(null);

  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { rows, isLoading, create, update, delete: deleteRow, isCreating } = useDefaultPrices();

  const hasPendingLoad = orgLoading || (!!organizationId && isLoading);
  const showContent = useDebouncedReady(!hasPendingLoad, 200);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingRow(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((row: DefaultPriceRow) => {
    setEditingRow(row);
    setDialogOpen(true);
  }, []);

  const handleOpenSop = useCallback((row: DefaultPriceRow) => {
    setSopModalRow(row);
  }, []);

  const handleSubmit = useCallback(
    async (payload: DefaultPriceCreate) => {
      if (editingRow) {
        await update({
          id: editingRow.id,
          payload: {
            unit_price: payload.unit_price,
            description: payload.description ?? null,
          } as DefaultPriceUpdate,
        });
      } else {
        await create(payload);
      }
      setDialogOpen(false);
      setEditingRow(null);
    },
    [editingRow, create, update],
  );

  return (
    <DefaultPricesModuleShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showContent={showContent}
    >
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Product &amp; Service</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Set default unit price per Service + Category. Used to auto-fill amount when a lead is converted
                      (Leads Management).
                    </p>
                  </div>
                  <Button onClick={handleAdd} disabled={!organizationId || isCreating}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
                <DefaultPricesTable
                  rows={rows}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onDelete={deleteRow}
                  onOpenSop={handleOpenSop}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DefaultPriceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        editingRow={editingRow}
      />

      <SopWorkflowModal
        open={sopModalRow != null}
        onOpenChange={(open) => !open && setSopModalRow(null)}
        defaultPriceRow={sopModalRow}
      />
    </DefaultPricesModuleShell>
  );
}
