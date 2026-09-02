import { useEffect, useMemo, useState } from 'react';
import { HeaderAndTab } from './HeaderAndTab';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, Search } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { usePermissionConfiguration, PermissionConfiguration } from '@/shared/auth/page-access/usePermissionConfiguration';
import { useToast } from '@/shared/components/ui/use-toast';
import { EmployeeMultiSelect } from '@/2-9-PageAccess/components/employee-multi-select';
import { AccessPermissionsOverview } from '@/2-9-PageAccess/components/AccessPermissionsOverview';
import { AccessPermissionsTableFooter } from '@/2-9-PageAccess/components/AccessPermissionsTableFooter';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import {
  PAGE_ACCESS_MAIN_COLUMN,
  PAGE_ACCESS_MAIN_GRID,
  PAGE_ACCESS_SIDEBAR_COLUMN,
  PAGE_ACCESS_TABLE_SECTION,
} from '@/2-9-PageAccess/layout/pageAccessLayout';

const ROLE_DESCRIPTIONS = {
  owner: {
    title: 'Organization Owner',
    description: 'Full access to all features and settings',
    color: 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue',
  },
  admin: {
    title: 'Admin',
    description: 'Can manage employees and most features',
    color: 'border-brand-blue/25 bg-brand-blue/10 text-brand-blue',
  },
  employee: {
    title: 'Employee',
    description: 'Basic access to core features',
    color: 'border-border bg-muted text-muted-foreground',
  },
};

interface CreatePageFormData {
  page_path: string;
  page_title: string;
  roles_allowed: string[];
  exceptions: string[];
  exception_paths: string[];
}

function matchesPathSearch(config: PermissionConfiguration, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const path = (config.page_path ?? '').toLowerCase();
  if (path.includes(q)) return true;
  const title = (config.page_title ?? '').toLowerCase();
  if (title.includes(q)) return true;
  return (config.exception_paths ?? []).some((p) => (p ?? '').toLowerCase().includes(q));
}

export const PageAccessTab = () => {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  
  const {
    configurations,
    loading,
    createPermissionConfiguration,
    updatePermissionConfiguration,
    deletePermissionConfiguration
  } = usePermissionConfiguration();

  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('page-access');
  const [pathSearch, setPathSearch] = useState('');
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PermissionConfiguration | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePageFormData>({
    page_path: '',
    page_title: '',
    roles_allowed: ['owner'],
    exceptions: [],
    exception_paths: []
  });

  // Prevent background/body scrolling while dialogs are open.
  // This also reduces visual glitches where modal content can appear to "overlap" parent layout.
  useEffect(() => {
    if (!showCreateDialog && !showEditDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreateDialog, showEditDialog]);

  const filteredConfigurations = useMemo(
    () => configurations.filter((config) => matchesPathSearch(config, pathSearch)),
    [configurations, pathSearch],
  );

  const pathSearchActive = pathSearch.trim().length > 0;

  const getRoleAccess = (config: PermissionConfiguration, role: string) => {
    return config.roles_allowed?.includes(role) || false;
  };

  const toggleRoleAccess = async (config: PermissionConfiguration, role: string) => {
    if (role === 'owner') return;

    const currentRoles = config.roles_allowed || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    setPendingRowId(config.id);
    try {
      const result = await updatePermissionConfiguration(config.id, { roles_allowed: newRoles });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save permission',
      });
    } finally {
      setPendingRowId(null);
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
      const result = await createPermissionConfiguration({
        ...formData,
        organization_id: organization?.id || null,
        is_active: true
      });

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

    setDeletingId(config.id);
    try {
      const result = await deletePermissionConfiguration(config.id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete page access');
      }
      toast({
        title: 'Success',
        description: 'Page access deleted successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete page access',
      });
    } finally {
      setDeletingId(null);
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                </div>

                <ModuleShellContentGate pagePath="/access-permissions/page-access">
                <div className={PAGE_ACCESS_MAIN_GRID}>
                  <div className={PAGE_ACCESS_MAIN_COLUMN}>
                    <div className={PAGE_ACCESS_TABLE_SECTION}>
                    <div className="bg-card border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm">
                        {/* Card Header */}
                        <div className="border-border flex-shrink-0 border-b px-4 py-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <h2 className="text-lg font-semibold text-foreground">Page Access Configuration</h2>
                              <p className="text-muted-foreground mt-1 text-sm">
                                Configure which roles can access specific pages and features
                              </p>
                            </div>
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                              <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:max-w-md">
                                <Search
                                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                                  aria-hidden
                                />
                                <Input
                                  type="search"
                                  value={pathSearch}
                                  onChange={(e) => setPathSearch(e.target.value)}
                                  placeholder={t(
                                    'pageAccess.config.searchPathPlaceholder',
                                    'Search by path, title, or exception path…',
                                  )}
                                  className="h-9 pl-9"
                                  aria-label={t(
                                    'pageAccess.config.searchPathAria',
                                    'Search page access paths',
                                  )}
                                />
                              </div>
                              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                              <DialogTrigger asChild>
                                <Button className="h-9 shrink-0 whitespace-nowrap">
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add New Page
                                </Button>
                              </DialogTrigger>
              <DialogContent
                hideCloseButton
                className="flex h-[520px] w-[520px] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden p-0"
              >
                <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-brand-blue/10 to-brand-blue/5 px-6 pb-4 pt-6 dark:from-brand-blue/15 dark:to-brand-blue/5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15">
                      <Plus className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="truncate text-xl font-semibold">
                        Create New Page Access
                      </DialogTitle>
                      <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                        Add a custom page with specific access permissions.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-24 space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                <DialogFooter className="relative z-30 px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full md:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePage} disabled={saving} className="w-full bg-brand-blue hover:bg-brand-blue/90 md:w-auto">
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
                        </div>
                        
                        {/* Scrollable Table Content - satu scroll container per panel */}
                        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-auto pb-6">
                          <div className="p-4">
                            {loading ? null : filteredConfigurations.length === 0 ? (
                              <p className="text-muted-foreground py-12 text-center text-sm">
                                {pathSearchActive
                                  ? t('pageAccess.config.searchNoResults', 'No pages match your search.')
                                  : t(
                                      'pageAccess.config.empty',
                                      'No page access configurations yet. Add a page to get started.',
                                    )}
                              </p>
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
                                    {filteredConfigurations.map(config => (
                                      <TableRow key={config.id}>
                                        <TableCell className="text-center">
                                          <div className="font-medium">{config.page_title}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <code className="bg-muted rounded px-2 py-1 text-xs">
                                            {config.page_path}
                                          </code>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant="outline" className="text-xs">Organisasi</Badge>
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
                                              onCheckedChange={() => void toggleRoleAccess(config, role)} 
                                              disabled={saving || pendingRowId === config.id || role === 'owner'}
                                              title={
                                                role === 'owner'
                                                  ? 'Role Owner selalu memiliki akses penuh ke semua halaman.'
                                                  : undefined
                                              }
                                            />
                                          </TableCell>
                                        ))}
                                        <TableCell className="text-center">
                                          <div className="flex items-center gap-1 justify-center">
                                            <Button variant="outline" size="sm" onClick={() => handleEditPage(config)}>
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              onClick={() => handleDeletePage(config)}
                                              disabled={deletingId === config.id}
                                              title="Delete page access configuration"
                                              className="text-red-600 hover:text-red-700 disabled:text-muted-foreground"
                                            >
                                              {deletingId === config.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3 h-3" />
                                              )}
                                            </Button>
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
                        <AccessPermissionsTableFooter
                          totalConfigurations={
                            pathSearchActive
                              ? filteredConfigurations.length
                              : configurations.length
                          }
                        />
                    </div>
                    </div>
                  </div>

                  <div className={PAGE_ACCESS_SIDEBAR_COLUMN}>
                    <div className={PAGE_ACCESS_TABLE_SECTION}>
                      <AccessPermissionsOverview configurations={configurations} />
                    </div>
                  </div>
                </div>
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
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



