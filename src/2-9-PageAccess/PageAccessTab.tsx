import { useState } from 'react';
import { HeaderAndTab } from './HeaderAndTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { usePermissionConfiguration, PermissionConfiguration } from '@/shared/auth/page-access/usePermissionConfiguration';
import { useToast } from '@/shared/components/ui/use-toast';
import { EmployeeMultiSelect } from '@/2-9-PageAccess/component/employee-multi-select';
import { AccessPermissionsOverview } from '@/2-9-PageAccess/component/AccessPermissionsOverview';
import { AccessPermissionsTableFooter } from '@/2-9-PageAccess/component/AccessPermissionsTableFooter';

const ROLE_DESCRIPTIONS = {
  owner: {
    title: 'Organization Owner',
    description: 'Full access to all features and settings',
    color: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  admin: {
    title: 'Administrator',
    description: 'Can manage employees and most features',
    color: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  employee: {
    title: 'Employee',
    description: 'Basic access to core features',
    color: 'bg-gray-100 text-gray-800 border-gray-300'
  }
};

interface CreatePageFormData {
  page_path: string;
  page_title: string;
  roles_allowed: string[];
  exceptions: string[];
  exception_paths: string[];
}

export const PageAccessTab = () => {
  const { userRole, organization } = useCentralizedUserData();
  
  const {
    configurations,
    loading,
    createPermissionConfiguration,
    updatePermissionConfiguration,
    deletePermissionConfiguration
  } = usePermissionConfiguration();
  
  // Debug logging
  console.log('🚀 PageAccessTab - configurations:', configurations);
  console.log('🚀 PageAccessTab - loading:', loading);
  console.log('🚀 PageAccessTab - configurations length:', configurations?.length);
  
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('page-access');
  const [localChanges, setLocalChanges] = useState<Record<string, string[]>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PermissionConfiguration | null>(null);
  const [formData, setFormData] = useState<CreatePageFormData>({
    page_path: '',
    page_title: '',
    roles_allowed: ['owner'],
    exceptions: [],
    exception_paths: []
  });

  const getRoleAccess = (config: PermissionConfiguration, role: string) => {
    return config.roles_allowed?.includes(role) || false;
  };

  const toggleRoleAccess = (config: PermissionConfiguration, role: string) => {
    if (role === 'owner') return;
    
    const currentRoles = config.roles_allowed || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    setLocalChanges(prev => ({
      ...prev,
      [config.id]: newRoles
    }));
  };

  const handleSaveSettings = async () => {
    try {
      for (const [configId, newRoles] of Object.entries(localChanges)) {
        await updatePermissionConfiguration(configId, { roles_allowed: newRoles });
      }
      setLocalChanges({});
      toast({
        title: 'Success',
        description: 'Permission settings saved successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save permission settings',
      });
    }
  };

  const handleCreatePage = async () => {
    if (!formData.page_path || !formData.page_title) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    // Validate page_path format
    if (!formData.page_path.startsWith('/')) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Page path must start with /',
      });
      return;
    }

    setSaving(true);
    try {
      console.log('🚀 Creating page access with data:', formData);
      
      const result = await createPermissionConfiguration({
        ...formData,
        organization_id: organization?.id || null,
        is_active: true
      });
      
      console.log('📋 Create result:', result);
      
      if (result.success) {
        setShowCreateDialog(false);
        setFormData({
          page_path: '',
          page_title: '',
          roles_allowed: ['owner'],
          exceptions: [],
          exception_paths: []
        });
        toast({
          title: 'Success',
          description: 'New page access created successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to create');
      }
    } catch (error) {
      console.error('❌ Failed to create page access:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create page access',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditPage = (config: PermissionConfiguration) => {
    setEditingConfig(config);
    setFormData({
      page_path: config.page_path,
      page_title: config.page_title,
      roles_allowed: config.roles_allowed || ['owner'],
      exceptions: config.exceptions || [],
      exception_paths: config.exception_paths || []
    });
    setShowEditDialog(true);
  };

  const handleUpdatePage = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      await updatePermissionConfiguration(editingConfig.id, {
        roles_allowed: formData.roles_allowed,
        exceptions: formData.exceptions,
        exception_paths: formData.exception_paths
      });
      setShowEditDialog(false);
      setEditingConfig(null);
      toast({
        title: 'Success',
        description: 'Page access updated successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update page access',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (config: PermissionConfiguration) => {
    if (!confirm(`Are you sure you want to delete access configuration for "${config.page_title}"?`)) {
      return;
    }

    try {
      await deletePermissionConfiguration(config.id);
      toast({
        title: 'Success',
        description: 'Page access deleted successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete page access',
      });
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all permissions to defaults? This will remove all custom configurations.')) {
      return;
    }

    try {
      // Reset functionality not implemented yet
      setLocalChanges({});
      toast({
        title: 'Info',
        description: 'Reset to defaults functionality will be implemented soon',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reset permissions',
      });
    }
  };

  const toggleFormRole = (role: string) => {
    if (role === 'owner') return;
    
    setFormData(prev => ({
      ...prev,
      roles_allowed: prev.roles_allowed.includes(role)
        ? prev.roles_allowed.filter(r => r !== role)
        : [...prev.roles_allowed, role]
    }));
  };

  const hasUnsavedChanges = Object.keys(localChanges).length > 0;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Debug logging - removed manual access check since ProtectedRoute handles it
  console.log('🔐 PageAccessTab Debug:', {
    userRole,
    configurations: configurations.length,
    configsLoaded: !loading
  });

  return (
    <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4 font-sans">
                <div className="mb-1 shrink-0">
                  <HeaderAndTab 
                    activeTab={activeTab} 
                    onTabChange={handleTabChange} 
                  />
                </div>
                
                {/* Main Content Area - Grid Layout */}
                <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
                  {/* Left Column - Main Content - 9 columns */}
                  <div className="col-span-9 flex flex-col min-h-0">
                    
                    {/* Main Card Section - fixed height sama dengan sidebar Access Overview */}
                    <div className="flex-1 min-h-0 max-h-[calc(100vh-120px)]">
                      <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                        {/* Card Header */}
                        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-lg font-semibold text-gray-900">Page Access Configuration</h2>
                              <p className="text-sm text-gray-600 mt-1">
                                Configure which roles can access specific pages and features
                              </p>
                            </div>
                            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                              <DialogTrigger asChild>
                                <Button>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add New Page
                                </Button>
                              </DialogTrigger>
              <DialogContent className="w-[520px] h-[520px] max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="text-xl font-semibold truncate">
                          Create New Page Access
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1 truncate">
                          Add a custom page with specific access permissions.
                        </DialogDescription>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formData.page_path || '/path'}
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
                  <div>
                    <Label htmlFor="page_path">Page Path *</Label>
                    <Input 
                      id="page_path" 
                      placeholder="/custom-page" 
                      value={formData.page_path} 
                      onChange={e => setFormData(prev => ({ ...prev, page_path: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="page_title">Page Title *</Label>
                    <Input 
                      id="page_title" 
                      placeholder="Custom Page Title" 
                      value={formData.page_title} 
                      onChange={e => setFormData(prev => ({ ...prev, page_title: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <Label>Allowed Roles</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {Object.keys(ROLE_DESCRIPTIONS).map(role => (
                        <div key={role} className="flex items-center space-x-2">
                          <Switch 
                            id={`create-${role}`} 
                            checked={formData.roles_allowed.includes(role)} 
                            onCheckedChange={() => toggleFormRole(role)} 
                            disabled={role === 'owner'} 
                          />
                          <Label htmlFor={`create-${role}`} className="text-sm capitalize">
                            {role} {role === 'owner' && '(Always has access)'}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <EmployeeMultiSelect 
                      label="Exceptions (Optional)" 
                      placeholder="Select employees who can access this page despite role restrictions..." 
                      value={formData.exceptions} 
                      onChange={employeeIds => setFormData(prev => ({ ...prev, exceptions: employeeIds }))} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      These employees will have access regardless of their role permissions.
                    </p>
                  </div>
                  <div>
                    <Label>Exception Paths (Optional)</Label>
                    <div className="space-y-2 mt-2">
                      {formData.exception_paths.map((path, index) => (
                        <div key={index} className="flex gap-2">
                          <Input 
                            value={path} 
                            onChange={e => {
                              const newPaths = [...formData.exception_paths];
                              newPaths[index] = e.target.value;
                              setFormData(prev => ({ ...prev, exception_paths: newPaths }));
                            }} 
                            placeholder="/recruitment/interviewees" 
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newPaths = formData.exception_paths.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, exception_paths: newPaths }));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setFormData(prev => ({ ...prev, exception_paths: [...prev.exception_paths, ''] }))}
                      >
                        Add Exception Path
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Specify paths that should remain accessible even when the main path is restricted.
                    </p>
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full md:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePage} disabled={saving} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : 'Create Page'}
                  </Button>
                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        
                        {/* Scrollable Table Content - satu scroll container per panel */}
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
                          <div className="p-4">
                            {loading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                Loading configurations...
                              </div>
                            ) : (
                              <div className="relative w-full min-h-0">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[200px] text-center">Page</TableHead>
                                      <TableHead className="w-[120px] text-center">Path</TableHead>
                                      <TableHead className="w-[80px] text-center">Type</TableHead>
                                      <TableHead className="w-[100px] text-center">Excluded Users</TableHead>
                                      <TableHead className="w-[120px] text-center">Exception Paths</TableHead>
                                      <TableHead className="w-[80px] text-center">Owner</TableHead>
                                      <TableHead className="w-[80px] text-center">Admin</TableHead>
                                      <TableHead className="w-[80px] text-center">Employee</TableHead>
                                      <TableHead className="w-[100px] text-center">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {configurations.map(config => (
                                      <TableRow key={config.id}>
                                        <TableCell className="text-center">
                                          <div className="font-medium">{config.page_title}</div>
                                          {localChanges[config.id] && (
                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 mt-1">
                                              Modified
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            {config.page_path}
                                          </code>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {config.organization_id === null ? (
                                            <Badge variant="secondary" className="text-xs">Default</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">Custom</Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {config.exceptions?.length || 0}
                                          {config.exceptions?.length > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Individual users with special access
                                            </div>
                                          )}
                                          {config.exceptions?.length === 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              No individual exceptions
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            {(config.exception_paths || []).map((path, index) => (
                                              <Badge key={index} variant="default" className="text-xs">
                                                {path}
                                              </Badge>
                                            ))}
                                            {(!config.exception_paths || config.exception_paths.length === 0) && (
                                              <span className="text-muted-foreground text-sm">None</span>
                                            )}
                                          </div>
                                        </TableCell>
                                        {Object.keys(ROLE_DESCRIPTIONS).map(role => (
                                          <TableCell key={role} className="text-center">
                                            <Switch 
                                              id={`${config.id}-${role}`} 
                                              checked={role === 'owner' ? true : getRoleAccess(config, role)} 
                                              onCheckedChange={() => toggleRoleAccess(config, role)} 
                                              disabled={saving || role === 'owner'} 
                                            />
                                          </TableCell>
                                        ))}
                                        <TableCell className="text-center">
                                          <div className="flex items-center gap-1 justify-center">
                                            <Button variant="outline" size="sm" onClick={() => handleEditPage(config)}>
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                            {config.organization_id !== null && (
                                              <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleDeletePage(config)} 
                                                className="text-red-600 hover:text-red-700"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Table Footer */}
                        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
                          <AccessPermissionsTableFooter 
                            totalConfigurations={configurations.length}
                            lastUpdated={configurations.find(c => c.organization_id !== null)?.updated_at}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Overview Sidebar - 3 columns, tinggi sama dengan table utama */}
                  <div className="col-span-3 h-full max-h-[calc(100vh-120px)]">
                    <AccessPermissionsOverview configurations={configurations} />
                  </div>
                </div>


      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Page Access</DialogTitle>
            <DialogDescription>
              Modify access permissions for this page
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Page Path</Label>
              <Input value={formData.page_path} disabled />
            </div>
            <div>
              <Label>Page Title</Label>
              <Input value={formData.page_title} disabled />
            </div>
            <div>
              <Label>Allowed Roles</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {Object.keys(ROLE_DESCRIPTIONS).map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Switch 
                      id={`edit-${role}`} 
                      checked={formData.roles_allowed.includes(role)} 
                      onCheckedChange={() => toggleFormRole(role)} 
                      disabled={role === 'owner'} 
                    />
                    <Label htmlFor={`edit-${role}`} className="text-sm capitalize">
                      {role} {role === 'owner' && '(Always has access)'}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <EmployeeMultiSelect 
                label="Exceptions (Optional)" 
                placeholder="Select employees who can access this page despite role restrictions..." 
                value={formData.exceptions} 
                onChange={employeeIds => setFormData(prev => ({ ...prev, exceptions: employeeIds }))} 
              />
              <p className="text-xs text-muted-foreground mt-1">
                These employees will have access regardless of their role permissions.
              </p>
            </div>
            <div>
              <Label>Exception Paths (Optional)</Label>
              <div className="space-y-2 mt-2">
                {formData.exception_paths.map((path, index) => (
                  <div key={index} className="flex gap-2">
                    <Input 
                      value={path} 
                      onChange={e => {
                        const newPaths = [...formData.exception_paths];
                        newPaths[index] = e.target.value;
                        setFormData(prev => ({ ...prev, exception_paths: newPaths }));
                      }} 
                      placeholder="/recruitment/interviewees" 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const newPaths = formData.exception_paths.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, exception_paths: newPaths }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setFormData(prev => ({ ...prev, exception_paths: [...prev.exception_paths, ''] }))}
                >
                  Add Exception Path
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Specify paths that should remain accessible even when the main path is restricted.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePage} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : 'Update Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};



