import { Shield, Building2 } from 'lucide-react';

interface AccessPermissionsSidebarFooterProps {
  userRole: string;
  organizationName: string;
  totalPages: number;
}

export const AccessPermissionsSidebarFooter = ({ 
  userRole, 
  organizationName,
  totalPages
}: AccessPermissionsSidebarFooterProps) => {
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'Organization Owner';
      case 'admin': return 'Administrator';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-purple-600';
      case 'admin': return 'text-blue-600';
      case 'employee': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1 truncate">
          <Shield className={`h-3 w-3 flex-shrink-0 ${getRoleColor(userRole)}`} />
          <span className={`truncate ${getRoleColor(userRole)} font-medium`}>
            {getRoleDisplayName(userRole)}
          </span>
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
          <Building2 className="h-3 w-3" />
          {totalPages} pages
        </span>
      </div>
      <div className="mt-1">
        <p className="text-xs text-gray-400 truncate">{organizationName}</p>
      </div>
    </div>
  );
};

