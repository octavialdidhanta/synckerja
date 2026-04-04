import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface Service {
  id: string;
  name: string;
}

interface SubService {
  id: string;
  name: string;
  description: string | null;
  service_id: string;
  is_active: boolean;
  organization_id: string;
}

interface CategoriesManagementDialogProps {
  open: boolean;
  onClose: () => void;
  selectedServiceId?: string;
  onCategorySelect?: (categoryName: string) => void;
  onCategoriesChanged?: () => void;
}

export const CategoriesManagementDialog = ({ 
  open, 
  onClose, 
  selectedServiceId,
  onCategorySelect, 
  onCategoriesChanged 
}: CategoriesManagementDialogProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [newSubService, setNewSubService] = useState({ 
    name: '', 
    description: '', 
    service_id: selectedServiceId || '' 
  });
  const [editingSubService, setEditingSubService] = useState<SubService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchSubServices = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSubServices(data || []);
    } catch (error) {
      console.error('Error fetching sub services:', error);
      toast({
        title: "Error",
        description: "Failed to fetch categories",
        variant: "destructive",
      });
    }
  };

  const handleCreateSubService = async () => {
    if (!newSubService.name.trim() || !newSubService.service_id) {
      toast({
        title: "Error",
        description: "Category name and service are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) throw new Error('No organization found');

      const { error } = await supabase
        .from('sub_services')
        .insert({
          name: newSubService.name.trim(),
          description: newSubService.description.trim() || null,
          service_id: newSubService.service_id,
          organization_id: profile.active_organization_id,
          is_active: true
        });

      if (error) throw error;

      setNewSubService({ name: '', description: '', service_id: selectedServiceId || '' });
      fetchSubServices();
      onCategoriesChanged?.();
      
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    } catch (error) {
      console.error('Error creating sub service:', error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSubService = async () => {
    if (!editingSubService || !editingSubService.name.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('sub_services')
        .update({
          name: editingSubService.name.trim(),
          description: editingSubService.description?.trim() || null,
        })
        .eq('id', editingSubService.id);

      if (error) throw error;

      setEditingSubService(null);
      fetchSubServices();
      onCategoriesChanged?.();
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    } catch (error) {
      console.error('Error updating sub service:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubService = async (subServiceId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('sub_services')
        .update({ is_active: false })
        .eq('id', subServiceId);

      if (error) throw error;

      fetchSubServices();
      onCategoriesChanged?.();
      
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting sub service:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || 'Unknown Service';
  };

  const filteredSubServices = selectedServiceId 
    ? subServices.filter(sub => sub.service_id === selectedServiceId)
    : subServices;

  useEffect(() => {
    if (open) {
      fetchServices();
      fetchSubServices();
    }
  }, [open]);

  useEffect(() => {
    if (selectedServiceId) {
      setNewSubService(prev => ({ ...prev, service_id: selectedServiceId }));
    }
  }, [selectedServiceId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Categories {selectedServiceId && `for ${getServiceName(selectedServiceId)}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Category */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Add New Category</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="serviceSelect">Service *</Label>
                <Select 
                  value={newSubService.service_id} 
                  onValueChange={(value) => setNewSubService(prev => ({ ...prev, service_id: value }))}
                  disabled={!!selectedServiceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="categoryName">Category Name *</Label>
                <Input
                  id="categoryName"
                  value={newSubService.name}
                  onChange={(e) => setNewSubService(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <Label htmlFor="categoryDescription">Description</Label>
                <Textarea
                  id="categoryDescription"
                  value={newSubService.description}
                  onChange={(e) => setNewSubService(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter category description"
                  className="min-h-[40px]"
                />
              </div>
            </div>
            <Button onClick={handleCreateSubService} disabled={isLoading} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          {/* Categories List */}
          <div className="space-y-2">
            <h3 className="font-medium">
              Existing Categories
              {selectedServiceId && ` for ${getServiceName(selectedServiceId)}`}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredSubServices.map((subService) => (
                <div key={subService.id} className="flex items-center justify-between p-3 border rounded-lg">
                  {editingSubService?.id === subService.id ? (
                    <div className="flex-1 grid grid-cols-2 gap-2 mr-3">
                      <Input
                        value={editingSubService.name}
                        onChange={(e) => setEditingSubService(prev => prev ? { ...prev, name: e.target.value } : null)}
                        placeholder="Category name"
                      />
                      <Input
                        value={editingSubService.description || ''}
                        onChange={(e) => setEditingSubService(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Description"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="font-medium">{subService.name}</div>
                      {!selectedServiceId && (
                        <div className="text-sm text-blue-600">{getServiceName(subService.service_id)}</div>
                      )}
                      {subService.description && (
                        <div className="text-sm text-gray-500">{subService.description}</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {editingSubService?.id === subService.id ? (
                      <>
                        <Button onClick={handleUpdateSubService} disabled={isLoading} size="sm" variant="outline">
                          Save
                        </Button>
                        <Button onClick={() => setEditingSubService(null)} size="sm" variant="outline">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {onCategorySelect && (
                          <Button
                            onClick={() => {
                              onCategorySelect(subService.name);
                              onClose();
                            }}
                            size="sm"
                            variant="outline"
                          >
                            Select
                          </Button>
                        )}
                        <Button
                          onClick={() => setEditingSubService(subService)}
                          size="sm"
                          variant="ghost"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteSubService(subService.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
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
};
