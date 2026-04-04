
import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/shared/components/ui/dropdown-menu';
import { Plus, X, Save, Trash2, Search } from 'lucide-react';
import { useSocialMediaNames } from '../../../hook/useSocialMediaNames';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { SocialMediaName } from '@/shared/types/social-media-names';

const PLATFORM_OPTIONS = [
  'Instagram',
  'TikTok', 
  'YouTube',
  'Facebook',
  'LinkedIn',
  'Twitter',
  'Shopee',
  'Tokopedia',
  'Other'
];

interface SocialMediaNameManagerProps {
  onDataChange?: () => void;
}

export const SocialMediaNameManager: React.FC<SocialMediaNameManagerProps> = ({ onDataChange }) => {
  const { organizationId } = useCurrentOrg();
  const { 
    socialMediaNames, 
    isLoading, 
    createName, 
    updateName, 
    deleteName,
    isCreating,
    isUpdating,
    isDeleting 
  } = useSocialMediaNames(organizationId);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState<SocialMediaName | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    platform: '',
    description: ''
  });

  const handleOpenDialog = (name?: SocialMediaName) => {
    if (name) {
      setEditingName(name);
      setFormData({
        name: name.name,
        platform: name.platform,
        description: name.description || ''
      });
    } else {
      setEditingName(null);
      setFormData({
        name: '',
        platform: '',
        description: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingName(null);
    setFormData({
      name: '',
      platform: '',
      description: ''
    });
  };

  const handleSave = async () => {
    if (!organizationId || !formData.name.trim() || !formData.platform) return;

    try {
      if (editingName) {
        await updateName({
          id: editingName.id,
          updates: {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined
          }
        });
      } else {
        await createName({
          organization_id: organizationId,
          name: formData.name.trim(),
          platform: formData.platform,
          description: formData.description.trim() || undefined
        });
      }
      
      handleCloseDialog();
      onDataChange?.();
    } catch (error) {
      console.error('Error saving social media name:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this social media name?')) {
      try {
        await deleteName(id);
        onDataChange?.();
      } catch (error) {
        console.error('Error deleting social media name:', error);
      }
    }
  };

  // Clear search when dropdown closes
  const handleDropdownChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery('');
    }
  };

  // Filter names by search query, then group by platform
  const filteredNames = searchQuery
    ? socialMediaNames.filter(name => 
        name.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        name.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (name.description && name.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : socialMediaNames;

  const groupedNames = filteredNames.reduce((acc, name) => {
    if (!acc[name.platform]) {
      acc[name.platform] = [];
    }
    acc[name.platform].push(name);
    return acc;
  }, {} as Record<string, SocialMediaName[]>);

  const isSaving = isCreating || isUpdating;

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleDropdownChange}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={isLoading || isDeleting}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-80 bg-white border shadow-lg z-[1000001] p-0 flex flex-col">
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white z-10 border-b p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Social Media Names</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDialog()}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Sticky Search */}
          <div className="sticky top-[50px] bg-white z-10 border-b">
            <div className="px-2 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search social media names..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="overflow-y-auto seamless-scroll max-h-[calc(20rem-91px)] p-2">
            {isLoading ? (
              <div className="text-xs text-gray-500 py-2">Loading...</div>
            ) : Object.keys(groupedNames).length === 0 ? (
              <div className="text-xs text-gray-500 py-2">
                {searchQuery ? `No social media names found for "${searchQuery}"` : 'No social media names yet'}
              </div>
            ) : (
              <div>
                {Object.entries(groupedNames).map(([platform, names], index) => (
                  <div key={platform}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <div className="py-1">
                      <div className="text-xs font-medium text-gray-600 mb-1">{platform}</div>
                      {names.map((name) => (
                        <div key={name.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                          <span className="text-xs truncate flex-1">{name.name}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(name)}
                              className="h-5 w-5 p-0"
                            >
                              <Plus className="h-2 w-2" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(name.id)}
                              className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-2 w-2" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingName ? 'Edit Social Media Name' : 'Add Social Media Name'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingName ? 'Edit social media name details' : 'Add a new social media name'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}
                disabled={!!editingName || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Social Media Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., @mycompany, My Brand"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description of this social media account"
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.platform || isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : editingName ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
