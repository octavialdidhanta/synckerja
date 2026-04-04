import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useLeadSources, LeadSource } from '@/shared/hooks/organized/salesources';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

interface SourceManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onSourceSelect?: (source: string) => void;
  onSourceAdded?: () => void;
}

export const SourceManagementDialog: React.FC<SourceManagementDialogProps> = ({
  open,
  onClose,
  onSourceSelect,
  onSourceAdded
}) => {
  const { sources, loading, createSource, updateSource, deleteSource } = useLeadSources();
  const [isEditing, setIsEditing] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = () => {
    setFormData({ name: '', description: '' });
    setEditingSource(null);
    setIsEditing(true);
  };

  const handleEdit = (source: LeadSource) => {
    setFormData({ name: source.name, description: source.description || '' });
    setEditingSource(source);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      if (editingSource) {
        await updateSource(editingSource.id, formData);
      } else {
        await createSource(formData);
        // Notify parent that a new source was added
        if (onSourceAdded) {
          onSourceAdded();
        }
      }
      setIsEditing(false);
      setFormData({ name: '', description: '' });
      setEditingSource(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this source?')) {
      await deleteSource(id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({ name: '', description: '' });
    setEditingSource(null);
  };

  const handleSelectSource = (sourceName: string) => {
    if (onSourceSelect) {
      onSourceSelect(sourceName);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Lead Sources</span>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdd}
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Source
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing && (
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Source Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter source name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      {editingSource ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingSource ? 'Update' : 'Create'
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={submitting}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading sources...</span>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <button
                          onClick={() => handleSelectSource(source.name)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {source.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {source.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(source.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sources.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                        No sources found. Click "Add Source" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
