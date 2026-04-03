import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
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
import { MoreVertical } from "lucide-react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDefaultPriceServiceOptions } from "../hooks/useDefaultPriceServiceOptions";
import type { DefaultPriceRow, DefaultPriceCreate } from "../types/defaultPrices";
import { ServicesManagementDialog } from "./ServicesManagementDialog";
import { CategoriesManagementDialog } from "./CategoriesManagementDialog";
import { formatIdIntegerGrouping, parseGroupedIdInteger, stripToDigits } from "../utils/formatIdUnitPrice";

export type DefaultPriceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DefaultPriceCreate) => Promise<void>;
  editingRow?: DefaultPriceRow | null;
};

export function DefaultPriceFormDialog({
  open,
  onOpenChange,
  onSubmit,
  editingRow,
}: DefaultPriceFormDialogProps) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { services, getSubServicesByService } = useDefaultPriceServiceOptions();
  const [serviceId, setServiceId] = useState("");
  const [subServiceId, setSubServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);

  const subServices = serviceId ? getSubServicesByService(serviceId) : [];

  const handleServicesChanged = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ["services", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["sub-services", organizationId] });
    }
  };

  const handleCategoriesChanged = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ["sub-services", organizationId] });
    }
  };

  useEffect(() => {
    if (!open) return;
    if (editingRow) {
      setServiceId(editingRow.service_id);
      setSubServiceId(editingRow.sub_service_id ?? "");
      setDescription(editingRow.description ?? "");
      const raw = editingRow.unit_price != null ? String(Math.round(Number(editingRow.unit_price))) : "";
      setUnitPrice(raw ? formatIdIntegerGrouping(stripToDigits(raw)) : "");
    } else {
      setServiceId("");
      setSubServiceId("");
      setDescription("");
      setUnitPrice("");
    }
    setError("");
  }, [open, editingRow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!organizationId) return;
    const service = services.find((s: { id: string }) => s.id === serviceId);
    if (!service) {
      setError("Please select a service.");
      return;
    }
    if (!editingRow && !subServiceId) {
      setError("Please select a category (sub-service).");
      return;
    }
    const price = parseGroupedIdInteger(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Unit price must be a non-negative number.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        organization_id: organizationId,
        service_id: serviceId,
        sub_service_id: subServiceId || null,
        unit_price: price,
        description: description.trim() || null,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingRow ? "Edit Default Price" : "Add Default Price"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="service">Service *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Kelola Service">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setServicesDialogOpen(true)}>Kelola Service</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Select
                value={serviceId}
                onValueChange={(v) => {
                  setServiceId(v);
                  setSubServiceId("");
                }}
                disabled={!!editingRow}
              >
                <SelectTrigger id="service" className="mt-1">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="category">Category (Sub-service) *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Kelola Kategori"
                      disabled={!serviceId}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCategoriesDialogOpen(true)} disabled={!serviceId}>
                      Kelola Kategori
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Select value={subServiceId} onValueChange={setSubServiceId} disabled={!serviceId || !!editingRow}>
                <SelectTrigger id="category" className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {subServices.map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
            <div>
              <Label htmlFor="unit_price">Unit Price (Rp) *</Label>
              <Input
                id="unit_price"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={unitPrice}
                onChange={(e) => {
                  const digits = stripToDigits(e.target.value);
                  setUnitPrice(digits ? formatIdIntegerGrouping(digits) : "");
                }}
                placeholder="0"
                className="mt-1"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingRow ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ServicesManagementDialog
        open={servicesDialogOpen}
        onClose={() => setServicesDialogOpen(false)}
        onServicesChanged={handleServicesChanged}
      />
      <CategoriesManagementDialog
        open={categoriesDialogOpen}
        onClose={() => setCategoriesDialogOpen(false)}
        selectedServiceId={serviceId || undefined}
        onCategoriesChanged={handleCategoriesChanged}
      />
    </>
  );
}
