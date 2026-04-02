import { Shield, Users, Settings, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { AccessPermissionsSidebarFooter } from './AccessPermissionsSidebarFooter';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

interface AccessPermissionsOverviewProps {
  configurations?: any[];
}

export const AccessPermissionsOverview = ({ configurations = [] }: AccessPermissionsOverviewProps) => {
  const { userRole, organization, employee } = useCentralizedUserData();

  // Calculate statistics from configurations
  const totalPages = configurations.length;
  const defaultPages = configurations.filter(config => config.organization_id === null).length;
  const customPages = configurations.filter(config => config.organization_id !== null).length;
  
  // Count by role access
  const ownerAccessible = configurations.filter(config => config.roles_allowed?.includes('owner')).length;
  const adminAccessible = configurations.filter(config => config.roles_allowed?.includes('admin')).length;
  const employeeAccessible = configurations.filter(config => config.roles_allowed?.includes('employee')).length;

  // Pages with exceptions
  const pagesWithExceptions = configurations.filter(config => 
    config.exceptions?.length > 0 || config.exception_paths?.length > 0
  ).length;

  // Most restrictive pages (only owner access)
  const ownerOnlyPages = configurations.filter(config => 
    config.roles_allowed?.length === 1 && config.roles_allowed[0] === 'owner'
  );

  return (
    <div className="bg-card border-border flex h-full min-h-0 flex-1 flex-col rounded-lg border">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-1.5">
        <h3 className="text-sm font-semibold text-foreground">Access Overview</h3>
        <p className="text-muted-foreground mt-1 text-xs">Permission statistics and insights</p>
      </div>

      {/* Keep sidebar data contained inside the card height */}
      <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg bg-brand-blue/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-blue">Total Pages</p>
                <p className="text-lg font-bold text-brand-blue">{totalPages}</p>
              </div>
              <Shield className="h-4 w-4 text-brand-blue" />
            </div>
          </div>

          <div className="bg-muted/60 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Default System</p>
                <p className="text-lg font-bold text-foreground">{defaultPages}</p>
              </div>
              <CheckCircle className="text-muted-foreground h-4 w-4" />
            </div>
          </div>

          <div className="rounded-lg bg-brand-blue/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-blue">Custom Pages</p>
                <p className="text-lg font-bold text-brand-blue">{customPages}</p>
              </div>
              <Settings className="h-4 w-4 text-brand-blue" />
            </div>
          </div>
        </div>

        {/* Role Access Stats */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Users className="h-3 w-3" />
            Access by Role
          </h4>
          <div className="space-y-2">
            <div className="rounded-lg bg-brand-blue/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-brand-blue">Owner Access</p>
                  <p className="text-xs text-brand-blue/80">{ownerAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="h-2 w-2 rounded-full bg-brand-blue" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-brand-blue/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-brand-blue">Admin Access</p>
                  <p className="text-xs text-brand-blue/80">{adminAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="h-2 w-2 rounded-full bg-brand-blue/70" />
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Employee Access</p>
                  <p className="text-muted-foreground text-xs">{employeeAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="bg-muted-foreground h-2 w-2 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Insights */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <AlertTriangle className="h-3 w-3" />
            Security Insights
          </h4>
          <div className="space-y-2">
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-800">Pages with Exceptions</p>
                  <p className="text-sm font-bold text-orange-900">{pagesWithExceptions}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-600">Special access</p>
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-1"></div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-800">Owner-Only Pages</p>
                  <p className="text-sm font-bold text-red-900">{ownerOnlyPages.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600">Highly restricted</p>
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Configurations */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Clock className="h-3 w-3" />
            Recent Configurations
          </h4>
          <div className="space-y-2">
            {configurations.length === 0 ? (
              <div className="bg-muted/40 rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-xs">No configurations found</p>
                <p className="text-muted-foreground mt-1 text-xs opacity-80">Add page configurations to see them here</p>
              </div>
            ) : (
              configurations.slice(0, 3).map((config) => (
                <div key={config.id} className="bg-muted/40 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">{config.page_title}</p>
                      <p className="text-muted-foreground text-xs">{config.page_path}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">
                        {config.organization_id === null ? 'System' : 'Custom'}
                      </p>
                      <div
                        className={`mt-1 h-2 w-2 rounded-full ${
                          config.organization_id === null ? 'bg-muted-foreground/50' : 'bg-brand-blue'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <AccessPermissionsSidebarFooter 
        userRole={userRole}
        organizationName={organization?.company_name || 'Organization'}
        totalPages={totalPages}
      />
    </div>
  );
};

