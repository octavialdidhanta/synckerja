
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Input } from '@/shared/components/ui/input';
import { 
  ChevronDown, 
  ChevronRight, 
  Users, 
  Building2, 
  Search,
  Crown,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { OrganizationalNode } from '@/2-8-organization/hooks/types';
import { getPhotoUrl, getInitials } from '@/2-1-employees/hooks/photoUtils';

interface OrganizationalChartProps {
  data: OrganizationalNode[];
  onEmployeeClick?: (employeeId: string) => void;
}

export const OrganizationalChart = ({ data, onEmployeeClick }: OrganizationalChartProps) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: OrganizationalNode[]) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children.length > 0) {
          collectIds(node.children);
        }
      });
    };
    collectIds(data);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    
    const filterNodes = (nodes: OrganizationalNode[]): OrganizationalNode[] => {
      return nodes.filter(node => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (node.employee?.email.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const hasMatchingChildren = node.children.length > 0 && filterNodes(node.children).length > 0;
        
        return matchesSearch || hasMatchingChildren;
      }).map(node => ({
        ...node,
        children: filterNodes(node.children)
      }));
    };
    
    return filterNodes(data);
  }, [data, searchTerm]);

  const renderNode = (node: OrganizationalNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const indentLevel = depth * 24;

    return (
      <div key={node.id} className="mb-2">
        <div 
          className={`flex items-center rounded-lg border p-3 transition-all duration-200 hover:shadow-md ${
            node.type === 'department' ? 'border-border bg-info-muted' :
            node.type === 'position' ? 'border-border bg-success-muted' :
            'border-border bg-card'
          }`}
          style={{ marginLeft: indentLevel }}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 mr-2"
              onClick={() => toggleNode(node.id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          
          {!hasChildren && <div className="w-8" />}

          <div className="flex items-center flex-1 min-w-0">
            {node.type === 'employee' && node.employee && (
              <Avatar className="h-8 w-8 mr-3">
                {getPhotoUrl(node.employee.photo_url) && (
                  <AvatarImage 
                    src={getPhotoUrl(node.employee.photo_url)!} 
                    alt={node.employee.full_name}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {getInitials(node.employee.full_name)}
                </AvatarFallback>
              </Avatar>
            )}

            {node.type === 'department' && (
              <Building2 className="mr-3 h-5 w-5 text-primary" />
            )}

            {node.type === 'position' && (
              <Users className="mr-3 h-5 w-5 text-success-foreground" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{node.name}</span>
                
                {node.employee?.is_organization_owner && (
                  <Crown className="h-4 w-4 text-warning-foreground" />
                )}
                
                {node.type !== 'employee' && node.employeeCount && (
                  <Badge variant="secondary" className="text-xs">
                    {node.employeeCount} {node.employeeCount === 1 ? 'person' : 'people'}
                  </Badge>
                )}

                {node.employee && (
                  <Badge variant="outline" className="text-xs">
                    {node.employee.job_level_name}
                  </Badge>
                )}
              </div>
              
              {node.employee && (
                <p className="truncate text-sm text-muted-foreground">{node.employee.email}</p>
              )}
            </div>

            {node.type === 'employee' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEmployeeClick?.(node.employee!.id)}
                className="ml-2"
              >
                View Profile
              </Button>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizational Structure
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search employees, departments, or positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div 
          className="space-y-2 transition-transform duration-200" 
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
        >
          {filteredData.length > 0 ? (
            filteredData.map(node => renderNode(node))
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {searchTerm ? 'No results found for your search.' : 'No organizational data available.'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
