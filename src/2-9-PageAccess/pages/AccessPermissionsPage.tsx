import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { useDepartmentAccess } from '@/shared/auth/page-access/useDepartmentAccess';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { usePermissionConfiguration } from '@/shared/auth/page-access/usePermissionConfiguration';
import { HeaderAndTab } from '@/2-9-PageAccess/section/HeaderAndTab';
import { PageAccessTab } from '@/2-9-PageAccess/section/PageAccessTab';
import { AccessPermissionsPageSkeleton } from '@/2-9-PageAccess/skeletons/AccessPermissionsPageSkeleton';

const ROLE_DESCRIPTIONS = {
  owner: {
    title: 'Organization Owner',
    description: 'Full access to all features and settings',
    color: 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue',
  },
  admin: {
    title: 'Administrator',
    description: 'Administrative access to most features',
    color: 'border-brand-blue/25 bg-brand-blue/10 text-brand-blue',
  },
  employee: {
    title: 'Employee',
    description: 'Limited access to personal and department data',
    color: 'border-border bg-muted text-muted-foreground',
  },
};

export const AccessPermissionsConfig = () => {
  const { userRole, loading: bootstrapLoading } = useCentralizedUserData();
  
  const {
    getAccessLevel,
    getDepartmentRestrictionMessage,
    canAccessPage,
    configLoading
  } = useDepartmentAccess();
  
  const {
    configurations,
    loading: permissionLoading,
  } = usePermissionConfiguration();
  
  const navigate = useNavigate();
  const location = useLocation();
  const isAccessPermissionsRoute = location.pathname.startsWith('/access-permissions');
  
  // Define tabs array for access checking and navigation
  const tabs = ['overview', 'roles', 'pages'];

  // Get active tab from URL path, default to 'overview'
  const getActiveTabFromPath = () => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const tabFromPath = pathSegments[pathSegments.length - 1] ?? "overview";
    if (tabFromPath === "page-access") return "pages";
    if (["overview", "roles", "pages"].includes(tabFromPath)) {
      return tabFromPath;
    }
    return "overview";
  };
  
  const activeTab = getActiveTabFromPath();
  const [routeSkeletonGate, setRouteSkeletonGate] = useState(true);
  const initialPending = configLoading || permissionLoading || bootstrapLoading || routeSkeletonGate;
  const [showSkeleton, setShowSkeleton] = useState(initialPending);

  useEffect(() => {
    if (!isAccessPermissionsRoute) {
      setRouteSkeletonGate(true);
      return;
    }
    const gateTimer = window.setTimeout(() => {
      setRouteSkeletonGate(false);
    }, 220);
    return () => window.clearTimeout(gateTimer);
  }, [isAccessPermissionsRoute, location.pathname]);

  useEffect(() => {
    if (initialPending) {
      setShowSkeleton(true);
      return;
    }
    const hideTimer = window.setTimeout(() => {
      setShowSkeleton(false);
    }, 180);
    return () => window.clearTimeout(hideTimer);
  }, [initialPending]);
  
  // MODIFIED: Always allow access to page-access tab (database-only control)
  const hasAccessToAnyTab = tabs.some(tab => {
    const tabPath = `/access-permissions/${tab}`;
    // Special case: Always allow page-access tab unless explicitly restricted in database
    if (tab === 'pages') {
      return true; // Always accessible unless DB restrictions exist
    }
    return canAccessPage(tabPath);
  });
  
  // Auto-redirect logic - only run once when component mounts or path changes
  useEffect(() => {
    if (configLoading) return; // Don't redirect while still loading
    
    const currentPath = location.pathname;
    
    try {
      // If user is on base path, redirect to page-access tab (always accessible)
      if (currentPath === '/access-permissions') {
        navigate('/access-permissions/page-access', { replace: true });
        return;
      }
      
      // MODIFIED: Allow page-access tab access, check other tabs normally
      if (currentPath.startsWith('/access-permissions/') && currentPath !== '/access-permissions') {
        // Special handling for page-access tab - always allow unless DB restrictions exist
        if (currentPath === '/access-permissions/page-access') {
          // Page access is controlled by database only - let useDepartmentAccess handle it
          return;
        }
        
        // For other tabs, check access normally
        if (!canAccessPage(currentPath)) {
          // Redirect to page-access as it's always accessible
          navigate('/access-permissions/page-access', { replace: true });
        }
      }
    } catch {
      // Fallback to overview if navigation fails
      if (currentPath !== '/access-permissions/page-access') {
        navigate('/access-permissions/page-access', { replace: true });
      }
    }
  }, [location.pathname, configLoading]); // Removed navigate and canAccessPage from deps to prevent loops

  // Define handleTabChange callback BEFORE conditional returns (Rules of Hooks)
  const handleTabChange = useCallback((tab: string) => {
    try {
      const targetPath = `/access-permissions/${tab}`;
      
      // Special handling for page-access tab - always allow unless DB restrictions exist
      if (tab === 'pages') {
        navigate('/access-permissions/page-access');
        return;
      }
      
      // Check access for other tabs
      if (canAccessPage(targetPath)) {
        navigate(targetPath);
      } else {
        // Redirect to page-access as fallback (always accessible)
        navigate('/access-permissions/page-access');
      }
    } catch {
      // Fallback to page-access tab
      navigate('/access-permissions/page-access');
    }
  }, [canAccessPage, navigate]);

  // CONDITIONAL RETURNS AFTER ALL HOOKS
  // Check if user has permission to view this page (respects exceptions)
  if (initialPending) {
    return <AccessPermissionsPageSkeleton />;
  }

  if (!hasAccessToAnyTab) {
    return (
      <div className="bg-background flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <div className="bg-card border-border mx-auto max-w-md rounded-lg border p-6 shadow-sm">
          <div className="text-center">
            <XCircle className="text-destructive mx-auto mb-4 h-16 w-16" />
            <h2 className="text-foreground mb-2 text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'pages') {
    return <PageAccessTab />;
  }

  return (
    <div className="bg-background relative flex min-h-0 min-w-0 flex-1 flex-col font-sans">
      {showSkeleton && (
        <AccessPermissionsPageSkeleton
          className="absolute inset-0 z-20 bg-background/95 backdrop-blur-[1px]"
          srLabel={null}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="mb-1 shrink-0">
                  <HeaderAndTab 
                    activeTab={activeTab} 
                    onTabChange={handleTabChange} 
                  />
                </div>
                
                <div className="border-border bg-card min-h-0 flex-1 overflow-y-auto rounded-lg border p-6 shadow-sm">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* REMOVED: Access denied alert for page-access - now database-controlled only */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Current Access Level</CardTitle>
                          <CardDescription>
                            Your current permissions and access level in the system
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={ROLE_DESCRIPTIONS[userRole]?.color || ''}>
                              {ROLE_DESCRIPTIONS[userRole]?.title || userRole}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {ROLE_DESCRIPTIONS[userRole]?.description}
                            </span>
                          </div>
                          
                          <Separator />
                          
                          <div className="space-y-2">
                            <h4 className="font-medium">Access Summary:</h4>
                            <p className="text-sm text-muted-foreground">{getAccessLevel()}</p>
                            {getDepartmentRestrictionMessage() && (
                              <p className="rounded-md border border-amber-200 bg-amber-50/80 p-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                                {getDepartmentRestrictionMessage()}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(ROLE_DESCRIPTIONS).map(([role, config]) => (
                              <div key={role} className="text-center p-4 border rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {configurations.filter(c => c.roles_allowed?.includes(role)).length}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {config.title} Access
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeTab === 'roles' && (
                    <div className="space-y-6">
                      {!canAccessPage('/access-permissions/roles') && (
                        <Alert className="mb-4 border-destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Access Denied</AlertTitle>
                          <AlertDescription>
                            You don't have permission to access the Role Permissions tab.
                            <br />
                            <strong>Your Access Level:</strong> {getAccessLevel()}
                            {getDepartmentRestrictionMessage() && (
                              <>
                                <br />
                                <strong>Restriction:</strong> <span className="text-destructive">{getDepartmentRestrictionMessage()}</span>
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      <Card>
                        <CardHeader>
                          <CardTitle>Role-Based Access Control</CardTitle>
                          <CardDescription>
                            Current role definitions and their access levels
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {Object.entries(ROLE_DESCRIPTIONS).map(([role, config]) => (
                            <div key={role} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Badge className={config.color}>{config.title}</Badge>
                                  <span className="text-sm text-muted-foreground">{config.description}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {role === userRole && "(Your Role)"}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  {role === 'owner' || role === 'admin' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  Full Department Access
                                </div>
                                <div className="flex items-center gap-2">
                                  {role === 'owner' || role === 'admin' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <HelpCircle className="w-4 h-4 text-yellow-500" />
                                  )}
                                  Employee Management
                                  {role === 'employee' && (
                                    <span className="text-xs text-gray-500 ml-1">(Database Controlled)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {role === 'owner' || role === 'admin' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  System Settings
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                </div>
          </div>
        </div>
      </div>
    </div>
  );
};


