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
      case 'owner':
      case 'admin':
        return 'text-brand-blue';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="border-border bg-muted/40 mt-2 flex-shrink-0 rounded-md border px-4 py-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 truncate">
          <Shield className={`h-3 w-3 flex-shrink-0 ${getRoleColor(userRole)}`} />
          <span className={`truncate font-medium ${getRoleColor(userRole)}`}>
            {getRoleDisplayName(userRole)}
          </span>
        </span>
        <span className="text-muted-foreground/80 flex flex-shrink-0 items-center gap-1 text-xs">
          <Building2 className="h-3 w-3" />
          {totalPages} pages
        </span>
      </div>
      <div className="mt-1">
        <p className="text-muted-foreground truncate text-xs">{organizationName}</p>
      </div>
    </div>
  );
};

