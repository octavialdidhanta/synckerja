import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';

interface Employee {
  id: string;
  full_name: string;
}

interface ApprovalConfig {
  id: string;
  columnType: string;
  columnName: string;
  allowedRoles: string[];
  exceptions: string[];
  isActive: boolean;
}

interface ApprovalAccessTableProps {
  configs: ApprovalConfig[];
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
  onEdit: (config: ApprovalConfig) => void;
  canManage?: boolean;
}

export const ApprovalAccessTable = ({ configs, onUpdate, onDelete, onEdit, canManage = true }: ApprovalAccessTableProps) => {
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});

  // Fetch employee names for exception IDs
  useEffect(() => {
    const fetchEmployeeNames = async () => {
      // Get all unique employee IDs from exceptions
      const employeeIds = Array.from(new Set(
        configs.flatMap(config => config.exceptions)
      ));

      if (employeeIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name')
          .in('id', employeeIds);

        if (error) {
          console.error('Error fetching employee names:', error);
          return;
        }

        const nameMap = (data || []).reduce((acc: Record<string, string>, emp: Employee) => {
          acc[emp.id] = emp.full_name;
          return acc;
        }, {});

        setEmployeeNames(nameMap);
      } catch (error) {
        console.error('Error fetching employee names:', error);
      }
    };

    fetchEmployeeNames();
  }, [configs]);
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'employee':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatRoleName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="align-middle">Column</TableHead>
            <TableHead className="align-middle">Allowed Roles</TableHead>
            <TableHead className="align-middle">Exceptions</TableHead>
            <TableHead className="align-middle">Status</TableHead>
            {canManage && <TableHead className="text-right align-middle w-32 pr-10">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((config) => (
            <TableRow key={config.id}>
              <TableCell className="align-middle">
                <div>
                  <div className="font-medium">{config.columnName}</div>
                  <div className="text-sm text-muted-foreground">{config.columnType}</div>
                </div>
              </TableCell>
              <TableCell className="align-middle">
                <div className="flex gap-1 flex-wrap">
                  {config.allowedRoles.map((role) => (
                    <Badge 
                      key={role} 
                      variant={getRoleBadgeVariant(role)}
                      className="text-xs"
                    >
                      {formatRoleName(role)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="align-middle">
                <div className="text-sm">
                  {config.exceptions.length > 0 ? (
                    <div className="space-y-1">
                      {config.exceptions.slice(0, 2).map((employeeId) => (
                        <Badge key={employeeId} variant="outline" className="text-xs mr-1">
                          {employeeNames[employeeId] || 'Loading...'}
                        </Badge>
                      ))}
                      {config.exceptions.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{config.exceptions.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="align-middle">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.isActive}
                    onCheckedChange={(checked) => 
                      onUpdate(config.id, { isActive: checked })
                    }
                    disabled={!canManage}
                  />
                  <span className="text-sm text-muted-foreground">
                    {config.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </TableCell>
              {canManage && (
                <TableCell className="text-right align-middle w-32 pr-10">
                  <div className="flex justify-end items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(config)}
                      className="h-9 w-9 p-0 flex items-center justify-center mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(config.id)}
                      className="text-destructive hover:text-destructive h-9 w-9 p-0 flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {configs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No approval configurations found.</p>
          <p className="text-sm">Click "Add New Configuration" to get started.</p>
        </div>
      )}
    </div>
  );
};