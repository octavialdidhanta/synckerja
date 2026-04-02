import { Shield, Users, Settings, TrendingUp, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { AccessPermissionsSidebarFooter } from './AccessPermissionsSidebarFooter';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { usePermissionConfiguration } from '@/shared/auth/page-access/usePermissionConfiguration';

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
    <div className="bg-white border rounded-lg h-full flex flex-col max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="px-4 py-1.5 border-b flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Access Overview</h3>
        <p className="text-xs text-gray-500 mt-1">Permission statistics and insights</p>
      </div>

      {/* Scrollable Content - satu scroll container dengan nested-scroll-touch-chain */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-800">Total Pages</p>
                <p className="text-lg font-bold text-blue-900">{totalPages}</p>
              </div>
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-800">Default System</p>
                <p className="text-lg font-bold text-green-900">{defaultPages}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-800">Custom Pages</p>
                <p className="text-lg font-bold text-purple-900">{customPages}</p>
              </div>
              <Settings className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Role Access Stats */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="h-3 w-3" />
            Access by Role
          </h4>
          <div className="space-y-2">
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-900">Owner Access</p>
                  <p className="text-xs text-purple-600">{ownerAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Admin Access</p>
                  <p className="text-xs text-blue-600">{adminAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Employee Access</p>
                  <p className="text-xs text-gray-600">{employeeAccessible} pages accessible</p>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Insights */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Recent Configurations
          </h4>
          <div className="space-y-2">
            {configurations.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500">No configurations found</p>
                <p className="text-xs text-gray-400 mt-1">Add page configurations to see them here</p>
              </div>
            ) : (
              configurations.slice(0, 3).map((config) => (
                <div key={config.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{config.page_title}</p>
                      <p className="text-xs text-gray-500">{config.page_path}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {config.organization_id === null ? 'System' : 'Custom'}
                      </p>
                      <div className={`w-2 h-2 rounded-full mt-1 ${
                        config.organization_id === null ? 'bg-green-500' : 'bg-blue-500'
                      }`}></div>
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

