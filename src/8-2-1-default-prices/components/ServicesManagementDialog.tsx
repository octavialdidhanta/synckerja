import { useState, useEffect, useCallback } from "react";
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
import { Plus, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

interface Service {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string;
}

export type ServicesManagementDialogProps = {
  open: boolean;
  onClose: () => void;
  onServiceSelect?: (serviceName: string) => void;
  onServicesChanged?: () => void;
};

export function ServicesManagementDialog({
  open,
  onClose,
  onServiceSelect,
  onServicesChanged,
}: ServicesManagementDialogProps) {
  const { organizationId } = useCurrentOrg();
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState({ name: "", description: "" });
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchServices = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices((data ?? []) as Service[]);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      });
    }
  }, [organizationId, toast]);

  const handleCreateService = async () => {
    if (!newService.name.trim()) {
      toast({
        title: "Error",
        description: "Service name is required",
        variant: "destructive",
      });
      return;
    }
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("services").insert({
        name: newService.name.trim(),
        description: newService.description.trim() || null,
        organization_id: organizationId,
        is_active: true,
      });

      if (error) throw error;

      setNewService({ name: "", description: "" });
      await fetchServices();
      onServicesChanged?.();

      toast({
        title: "Success",
        description: "Service created successfully",
      });
    } catch (error) {
      console.error("Error creating service:", error);
      toast({
        title: "Error",
        description: "Failed to create service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService || !editingService.name.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({
          name: editingService.name.trim(),
          description: editingService.description?.trim() || null,
        })
        .eq("id", editingService.id);

      if (error) throw error;

      setEditingService(null);
      await fetchServices();
      onServicesChanged?.();

      toast({
        title: "Success",
        description: "Service updated successfully",
      });
    } catch (error) {
      console.error("Error updating service:", error);
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("services").update({ is_active: false }).eq("id", serviceId);

      if (error) throw error;

      await fetchServices();
      onServicesChanged?.();

      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchServices();
    }
  }, [open, fetchServices]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Manage Services</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">Add New Service</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceName">Service Name *</Label>
                <Input
                  id="serviceName"
                  value={newService.name}
                  onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter service name"
                />
              </div>
              <div>
                <Label htmlFor="serviceDescription">Description</Label>
                <Textarea
                  id="serviceDescription"
                  value={newService.description}
                  onChange={(e) => setNewService((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter service description"
                  className="min-h-[40px]"
                />
              </div>
            </div>
            <Button onClick={() => void handleCreateService()} disabled={isLoading} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Existing Services</h3>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-lg border p-3">
                  {editingService?.id === service.id ? (
                    <div className="mr-3 grid flex-1 grid-cols-2 gap-2">
                      <Input
                        value={editingService.name}
                        onChange={(e) =>
                          setEditingService((prev) => (prev ? { ...prev, name: e.target.value } : null))
                        }
                        placeholder="Service name"
                      />
                      <Input
                        value={editingService.description || ""}
                        onChange={(e) =>
                          setEditingService((prev) => (prev ? { ...prev, description: e.target.value } : null))
                        }
                        placeholder="Description"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="font-medium">{service.name}</div>
                      {service.description ? (
                        <div className="text-sm text-muted-foreground">{service.description}</div>
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {editingService?.id === service.id ? (
                      <>
                        <Button onClick={() => void handleUpdateService()} disabled={isLoading} size="sm" variant="outline">
                          Save
                        </Button>
                        <Button onClick={() => setEditingService(null)} size="sm" variant="outline">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {onServiceSelect ? (
                          <Button
                            onClick={() => {
                              onServiceSelect(service.name);
                              onClose();
                            }}
                            size="sm"
                            variant="outline"
                          >
                            Select
                          </Button>
                        ) : null}
                        <Button onClick={() => setEditingService(service)} size="sm" variant="ghost">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => void handleDeleteService(service.id)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
