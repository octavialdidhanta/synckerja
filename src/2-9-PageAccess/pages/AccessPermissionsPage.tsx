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
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';

const ROLE_DESCRIPTIONS = {
  owner: {
    title: 'Organization Owner',
    description: 'Full access to all features and settings',
    color: 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue',
  },
  admin: {
    title: 'Admin',
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
    configBootstrapPending,
    accessDecisionPending,
  } = useDepartmentAccess();
  
  const {
    configurations,
  } = usePermissionConfiguration();
  
  const navigate = useNavigate();
  const location = useLocation();
  const isAccessPermissionsRoute = location.pathname.startsWith('/access-permissions');
  
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
  const initialPending =
    configBootstrapPending || accessDecisionPending || bootstrapLoading || routeSkeletonGate;
  const [showSkeleton, setShowSkeleton] = useState(initialPending);

  const accessPaths = {
    overview: '/access-permissions/overview',
    pageAccess: '/access-permissions/page-access',
    roles: '/access-permissions/roles',
  } as const;

  const firstAccessiblePath = useCallback((): string | null => {
    const order = [accessPaths.overview, accessPaths.pageAccess, accessPaths.roles];
    for (const p of order) {
      if (canAccessPage(p)) return p;
    }
    return null;
  }, [canAccessPage]);

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
  
  // Auto-redirect logic - only run once when component mounts or path changes
  useEffect(() => {
    if (configBootstrapPending || accessDecisionPending) return;

    const currentPath = location.pathname;

    try {
      if (currentPath === '/access-permissions') {
        const dest = firstAccessiblePath();
        if (dest) navigate(dest, { replace: true });
        return;
      }

      if (currentPath.startsWith('/access-permissions/')) {
        if (!canAccessPage(currentPath)) {
          const dest = firstAccessiblePath();
          if (dest && dest !== currentPath) navigate(dest, { replace: true });
        }
      }
    } catch {
      const dest = firstAccessiblePath();
      if (dest) navigate(dest, { replace: true });
    }
  }, [
    location.pathname,
    configBootstrapPending,
    accessDecisionPending,
    canAccessPage,
    firstAccessiblePath,
    navigate,
  ]);

  // Define handleTabChange callback BEFORE conditional returns (Rules of Hooks)
  const handleTabChange = useCallback((tab: string) => {
    try {
      if (tab === 'pages') {
        if (canAccessPage(accessPaths.pageAccess)) navigate(accessPaths.pageAccess);
        else {
          const dest = firstAccessiblePath();
          if (dest) navigate(dest);
        }
        return;
      }

      const targetPath = `/access-permissions/${tab}`;
      if (canAccessPage(targetPath)) {
        navigate(targetPath);
      } else {
        const dest = firstAccessiblePath();
        if (dest) navigate(dest);
      }
    } catch {
      const dest = firstAccessiblePath();
      if (dest) navigate(dest);
    }
  }, [canAccessPage, navigate, firstAccessiblePath]);

  // CONDITIONAL RETURNS AFTER ALL HOOKS
  // Check if user has permission to view this page (respects exceptions)
  if (initialPending) {
    return <AccessPermissionsPageSkeleton />;
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

                <ModuleShellContentGate pagePath={location.pathname}>
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
                </ModuleShellContentGate>
          </div>
        </div>
      </div>
    </div>
  );
};


