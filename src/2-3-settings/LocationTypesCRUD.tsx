import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, Edit, Trash2, MoreVertical, MapPin, Building, Users, Hammer } from 'lucide-react';
import { useLocationTypes } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

export const LocationTypesCRUD = () => {
  const { locationTypes, loading, addLocationType, updateLocationType, deleteLocationType } = useLocationTypes();
  const { organizationId } = useCurrentOrg();
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'MapPin'
  });
  const { toast } = useToast();

  const iconOptions = [
    { value: 'Building', label: 'Building', icon: Building },
    { value: 'MapPin', label: 'Map Pin', icon: MapPin },
    { value: 'Users', label: 'Users', icon: Users },
    { value: 'Hammer', label: 'Hammer', icon: Hammer }
  ];

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
  ];

  const handleEdit = (type: any) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || '',
      color: type.color || '#3B82F6',
      icon: type.icon || 'MapPin'
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingType(null);
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      icon: 'MapPin'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!organizationId) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive"
        });
        return;
      }

      const locationTypeData = {
        ...formData,
        organization_id: organizationId,
        is_active: true
      };
      
      if (editingType) {
        await updateLocationType(editingType.id, locationTypeData);
        toast({
          title: "Success",
          description: "Location type updated successfully"
        });
      } else {
        await addLocationType(locationTypeData);
        toast({
          title: "Success", 
          description: "Location type added successfully"
        });
      }
      setShowModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save location type",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location type?')) return;
    
    try {
      await deleteLocationType(id);
      toast({
        title: "Success",
        description: "Location type deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to delete location type",
        variant: "destructive"
      });
    }
  };

  const getIcon = (iconName: string) => {
    const iconOption = iconOptions.find(opt => opt.value === iconName);
    return iconOption ? iconOption.icon : MapPin;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Types
            </CardTitle>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : locationTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No location types found</p>
              <Button onClick={handleAdd} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add First Type
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {locationTypes.map((type) => {
                const IconComponent = getIcon(type.icon || 'MapPin');
                return (
                  <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded"
                        style={{ backgroundColor: `${type.color}15`, color: type.color }}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{type.name}</div>
                        {type.description && (
                          <div className="text-sm text-gray-600">{type.description}</div>
                        )}
                      </div>
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: `${type.color}15`,
                          color: type.color,
                          borderColor: `${type.color}30`
                        }}
                      >
                        {type.color}
                      </Badge>
                    </div>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40" align="end">
                        <div className="space-y-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => handleEdit(type)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(type.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Edit Location Type' : 'Add Location Type'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Kelola nama, deskripsi, dan ikon untuk tipe lokasi yang dapat dipilih karyawan saat mencatat absensi.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Office, Client Site"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this location type"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="icon">Icon</Label>
              <Select 
                value={formData.icon} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 mt-1">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded border-2 ${
                      formData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
              <Input
                className="mt-2"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                placeholder="#3B82F6"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingType ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
