import React, { useState, useRef, useCallback, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Building2, Crown } from 'lucide-react';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { getPhotoUrl, getInitials } from '@/2-1-employees/hooks/photoUtils';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { isEmployeeInOrganizationalStructure } from '@/2-1-employees/utils/employeeUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { cn } from '@/shared/lib/utils';

export type OrganizationalDiagramHandle = {
  resetView: () => void;
};

export interface OrganizationalDiagramProps {
  onEmployeeClick?: (employeeId: string) => void;
  searchTerm: string;
  zoomLevel: number;
  onZoomLevelChange: (value: number) => void;
}

interface HierarchyNode {
  id: string;
  employee: any;
  level: number;
  levelName: string;
  children: HierarchyNode[];
}

/** Dark gradient node — avatar uses white disc so initials/photos stay readable */
const avatarOnDarkClass =
  'h-16 w-16 ring-[3px] ring-white/95 shadow-md bg-white/10';
const avatarFallbackDarkClass = 'bg-white text-slate-900 text-lg font-semibold';

function getEmployeeNodeCardClasses(level: number, isOwner: boolean): {
  card: string;
  avatar: string;
  avatarFallback: string;
  name: string;
  badge: string;
  meta: string;
  email: string;
  crown: string;
} {
  const ownerRing = isOwner ? ' ring-2 ring-amber-300 shadow-[0_0_0_1px_rgba(253,224,71,0.35)]' : '';

  if (level === 0) {
    // Root under company header — distinct from org bar (lighter / different hue)
    return {
      card: `bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 text-white shadow-lg${ownerRing}`,
      avatar: `${avatarOnDarkClass}`,
      avatarFallback: avatarFallbackDarkClass,
      name: 'text-white',
      badge: 'border-0 bg-white/20 text-white hover:bg-white/25',
      meta: 'text-white/90',
      email: 'text-white/80',
      crown: 'text-amber-300',
    };
  }
  if (level === 1) {
    return {
      card: `bg-gradient-to-br from-teal-600 via-emerald-700 to-emerald-900 text-white shadow-lg${ownerRing}`,
      avatar: `${avatarOnDarkClass}`,
      avatarFallback: avatarFallbackDarkClass,
      name: 'text-white',
      badge: 'border-0 bg-white/20 text-white hover:bg-white/25',
      meta: 'text-white/90',
      email: 'text-white/80',
      crown: 'text-amber-300',
    };
  }
  return {
    card: `border-2 border-border bg-card text-card-foreground shadow-md${isOwner ? ' ring-2 ring-amber-400 ring-offset-2 ring-offset-background' : ''}`,
    avatar: 'h-16 w-16 ring-2 ring-border shadow-sm bg-background',
    avatarFallback: 'bg-primary/15 text-primary text-lg font-semibold',
    name: 'text-foreground',
    badge: '',
    meta: 'text-muted-foreground',
    email: 'text-muted-foreground',
    crown: 'text-amber-600',
  };
}

export const OrganizationalDiagram = forwardRef<OrganizationalDiagramHandle, OrganizationalDiagramProps>(
  function OrganizationalDiagram(
    { onEmployeeClick, searchTerm, zoomLevel, onZoomLevelChange },
    ref
  ) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  zoomRef.current = zoomLevel;

  const dragActiveRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const panRafRef = useRef<number | null>(null);
  const { t } = useAppTranslation();

  const applyTransform = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const { x, y } = panRef.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoomRef.current})`;
  }, []);

  useLayoutEffect(() => {
    if (!dragActiveRef.current) {
      panRef.current = { ...pan };
    }
    applyTransform();
  }, [pan, applyTransform]);

  useLayoutEffect(() => {
    applyTransform();
  }, [zoomLevel, applyTransform]);

  const schedulePanTransform = useCallback(() => {
    if (panRafRef.current != null) return;
    panRafRef.current = requestAnimationFrame(() => {
      panRafRef.current = null;
      applyTransform();
    });
  }, [applyTransform]);

  const handlePanePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-org-node]')) return;

    dragActiveRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault();
    }
  }, []);

  const handlePanePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActiveRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (dx === 0 && dy === 0) return;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      schedulePanTransform();
    },
    [schedulePanTransform]
  );

  const endPaneDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      applyTransform();

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }

      const wasDragging = dragActiveRef.current;
      dragActiveRef.current = false;

      if (wasDragging) {
        setPan((prev) => {
          const next = panRef.current;
          if (prev.x === next.x && prev.y === next.y) return prev;
          return { x: next.x, y: next.y };
        });
      }
    },
    [applyTransform]
  );

  const resetView = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    onZoomLevelChange(1);
  }, [onZoomLevelChange]);

  useImperativeHandle(ref, () => ({ resetView }), [resetView]);

  const { data: allEmployees = [], isLoading } = useEmployees();
  const { data: currentUserEmployee } = useCurrentUserEmployee();
  const { organization, organizationName: contextOrganizationName } = useCentralizedUserData();

  // Exclude only resigned/terminated/inactive/pending removal; include active, probation, contract, etc.
  const employees = React.useMemo(
    () => allEmployees.filter(isEmployeeInOrganizationalStructure),
    [allEmployees]
  );

  const buildHierarchy = React.useMemo(() => {
    const organizationName = contextOrganizationName || organization?.company_name || 'Organization';
    if (!employees.length) {
      return {
        rootNodes: [] as HierarchyNode[],
        orphanForest: [] as HierarchyNode[],
        organizationName,
        hasOrphans: false,
        multipleRoots: false,
        noRoot: false,
      };
    }

    const childrenByManager = new Map<string, typeof employees[number][]>();
    for (const e of employees) {
      if (!e.manager_id) continue;
      const list = childrenByManager.get(e.manager_id) ?? [];
      list.push(e);
      childrenByManager.set(e.manager_id, list);
    }

    const createNode = (employee: (typeof employees)[number], depth: number): HierarchyNode => ({
      id: employee.id,
      employee,
      level: depth,
      levelName: employee.job_level_name || 'Employee',
      children: [],
    });

    const buildTree = (emp: (typeof employees)[number], depth: number): HierarchyNode => {
      const node = createNode(emp, depth);
      for (const c of childrenByManager.get(emp.id) || []) {
        node.children.push(buildTree(c, depth + 1));
      }
      return node;
    };

    const roots = employees.filter((e) => !e.manager_id);
    const multipleRoots = roots.length > 1;
    const noRoot = roots.length === 0;
    const rootNodes = roots.map((r) => buildTree(r, 0));

    const collectIds = (n: HierarchyNode, s: Set<string>) => {
      s.add(n.id);
      n.children.forEach((c) => collectIds(c, s));
    };
    const inMain = new Set<string>();
    rootNodes.forEach((n) => collectIds(n, inMain));
    const disconnected = employees.filter((e) => !inMain.has(e.id));
    const hasOrphans = disconnected.length > 0;

    const discSet = new Set(disconnected.map((d) => d.id));
    const orphanRoots = disconnected.filter((e) => !e.manager_id || !discSet.has(e.manager_id));
    const buildBounded = (emp: (typeof employees)[number], depth: number): HierarchyNode => {
      const node = createNode(emp, depth);
      for (const c of (childrenByManager.get(emp.id) || []).filter((x) => discSet.has(x.id))) {
        node.children.push(buildBounded(c, depth + 1));
      }
      return node;
    };
    const orphanForest = orphanRoots.map((r) => buildBounded(r, 0));

    return {
      rootNodes,
      orphanForest,
      organizationName,
      hasOrphans,
      multipleRoots,
      noRoot,
    };
  }, [employees, contextOrganizationName, organization]);

  const filterTree = React.useCallback(
    (nodes: HierarchyNode[]): HierarchyNode[] => {
      if (!searchTerm) return nodes;
      const q = searchTerm.toLowerCase();
      const filterNodes = (list: HierarchyNode[]): HierarchyNode[] =>
        list
          .filter((node) => {
            const matchesSearch =
              node.employee.full_name.toLowerCase().includes(q) ||
              (node.employee.email?.toLowerCase().includes(q) ?? false) ||
              node.levelName.toLowerCase().includes(q);
            const childFiltered = filterNodes(node.children);
            const hasMatchingChildren = childFiltered.length > 0;
            return matchesSearch || hasMatchingChildren;
          })
          .map((node) => ({
            ...node,
            children: filterNodes(node.children),
          }));
      return filterNodes(nodes);
    },
    [searchTerm]
  );

  const filteredRootNodes = React.useMemo(
    () => filterTree(buildHierarchy.rootNodes),
    [buildHierarchy.rootNodes, filterTree]
  );

  const filteredOrphanForest = React.useMemo(
    () => filterTree(buildHierarchy.orphanForest),
    [buildHierarchy.orphanForest, filterTree]
  );

  const renderNode = (node: HierarchyNode) => {
    const isOwner = node.employee.is_organization_owner;
    const nodeStyle = getEmployeeNodeCardClasses(node.level, isOwner);

    // Check if this employee is the current user and use their profile photo
    const isCurrentUser = currentUserEmployee && (
      node.employee.id === currentUserEmployee.id ||
      node.employee.user_id === currentUserEmployee.user_id
    );

    const avatarPhotoUrl = isCurrentUser && currentUserEmployee?.profile_photo_url
      ? currentUserEmployee.profile_photo_url
      : node.employee.photo_url;

    return (
      <div key={node.id} className="flex flex-col items-center mb-8">
        {/* Employee Node */}
        <div className="relative">
          <div
            data-org-node
            className={cn(
              'min-w-[200px] cursor-pointer rounded-lg p-4 text-center transition-all hover:shadow-xl',
              nodeStyle.card
            )}
            onClick={() => onEmployeeClick?.(node.employee.id)}
          >
            <div className="flex flex-col items-center gap-3">
              <Avatar className={cn(nodeStyle.avatar)}>
                {getPhotoUrl(avatarPhotoUrl) && (
                  <AvatarImage
                    src={getPhotoUrl(avatarPhotoUrl)!}
                    alt={node.employee.full_name}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className={nodeStyle.avatarFallback}>
                  {getInitials(node.employee.full_name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <div className="mb-1 flex items-center justify-center gap-2">
                  <span className={cn('font-semibold text-lg', nodeStyle.name)}>{node.employee.full_name}</span>
                  {isOwner && <Crown className={cn('h-5 w-5 shrink-0', nodeStyle.crown)} aria-hidden />}
                </div>

                <Badge
                  variant={node.level >= 2 ? 'outline' : 'secondary'}
                  className={cn('mb-2', nodeStyle.badge)}
                >
                  {node.levelName}
                </Badge>

                {node.employee.department_name && (
                  <p className={cn('mb-1 text-sm', nodeStyle.meta)}>{node.employee.department_name}</p>
                )}

                <p className={cn('text-xs', nodeStyle.email)}>{node.employee.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Line */}
        {node.children.length > 0 && (
          <div className="my-2 h-8 w-0.5 bg-border" />
        )}

        {/* Children */}
        {node.children.length > 0 && (
          <div className="flex flex-wrap justify-center gap-12">
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                {renderNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* Initial load: no local skeleton — parent route shows single OrganizationPageSkeleton overlay */
  if (isLoading) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        role="application"
        aria-label={t('organization.diagram.panHint', 'Drag empty area to pan the chart (hand cursor).')}
        className="relative flex min-h-0 w-full flex-1 cursor-grab touch-none select-none overflow-hidden rounded-md bg-muted/40 selection:bg-transparent active:cursor-grabbing"
        onPointerDown={handlePanePointerDown}
        onPointerMove={handlePanePointerMove}
        onPointerUp={endPaneDrag}
        onPointerCancel={endPaneDrag}
      >
        <div
          ref={innerRef}
          className="mx-auto w-max max-w-none origin-top p-4 will-change-transform sm:p-6"
        >
          {/* Organization Header — tier above diagram nodes (darker than level-0 employee cards) */}
          <div className="mb-8 text-center">
            <div className="inline-block rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-8 py-5 text-white shadow-lg ring-1 ring-white/10">
              <div className="flex items-center justify-center gap-3">
                <Building2 className="h-8 w-8 shrink-0 text-sky-200" aria-hidden />
                <h2 className="text-2xl font-bold text-white">{buildHierarchy.organizationName}</h2>
              </div>
            </div>
            {(filteredRootNodes.length > 0 || filteredOrphanForest.length > 0) && (
              <div className="mx-auto mt-4 h-8 w-0.5 bg-border" />
            )}
          </div>

          {buildHierarchy.noRoot && employees.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t('organization.diagram.noRoot', 'No hierarchy root')}</AlertTitle>
              <AlertDescription>
                {t('organization.diagram.noRoot', 'No employee without a manager (root). Check manager_id data and organization owner.')}
              </AlertDescription>
            </Alert>
          )}

          {buildHierarchy.multipleRoots && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t('organization.diagram.multipleRoots', 'Multiple roots')}</AlertTitle>
              <AlertDescription>
                {t('organization.diagram.multipleRoots', 'Multiple roots found; only the organization owner should have no manager.')}
              </AlertDescription>
            </Alert>
          )}

          {buildHierarchy.hasOrphans && (
            <Alert className="mb-4 border-warning/30 bg-warning-muted">
              <AlertTitle>{t('organization.diagram.orphanWarning', 'Hierarchy warning')}</AlertTitle>
              <AlertDescription>
                {t('organization.diagram.orphanWarning', 'Some employees are not attached to the main tree.')}
              </AlertDescription>
            </Alert>
          )}

          {filteredRootNodes.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-12">
              {filteredRootNodes.map((node) => renderNode(node))}
            </div>
          ) : filteredOrphanForest.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchTerm ? 'No results found for your search.' : 'No employees found.'}
            </div>
          ) : null}

          {filteredOrphanForest.length > 0 && (
            <div className="mt-10 border-t border-border pt-8">
              <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
                {t('organization.diagram.orphanWarning', 'Employees outside main tree')}
              </p>
              <div className="flex flex-wrap justify-center gap-12">
                {filteredOrphanForest.map((node) => renderNode(node))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
