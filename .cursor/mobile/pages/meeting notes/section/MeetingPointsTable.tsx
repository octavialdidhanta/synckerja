import { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, History, User, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Badge } from '@/features/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/ui/table';
import { useMeetingNotes, type MeetingPoint } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { logger } from '@/config/logger';
import EditMeetingPointDialog from '@/mobile/pages/meeting notes/modal/EditMeetingPointDialog';
import DeleteMeetingPointDialog from '@/mobile/pages/meeting notes/modal/DeleteMeetingPointDialog';
import UpdateHistoryDialog from '@/mobile/pages/meeting notes/modal/UpdateHistoryDialog';
import IssuesDialog from '@/mobile/pages/meeting notes/modal/IssuesDialog';
import './MeetingPointsTable.css';

interface MeetingPointsTableProps {
  /** When provided, table shows only these points (e.g. pre-filtered by parent). */
  points?: MeetingPoint[];
}

const MeetingPointsTable = ({ points: pointsProp }: MeetingPointsTableProps) => {
  const { meetingPoints, filters, updateMeetingPoint, deleteMeetingPoint, getUpdateCount, getIssueHistory } = useMeetingNotes();
  const [editingPoint, setEditingPoint] = useState<MeetingPoint | null>(null);
  const [deletingPoint, setDeletingPoint] = useState<MeetingPoint | null>(null);
  const [historyPoint, setHistoryPoint] = useState<MeetingPoint | null>(null);
  const [issuesPoint, setIssuesPoint] = useState<MeetingPoint | null>(null);
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({});
  const [updateCounts, setUpdateCounts] = useState<Record<string, number>>({});

  const filteredPoints = useMemo(() => {
    if (pointsProp) return pointsProp;
    return meetingPoints.filter(point => {
      if (filters.search && !(point.discussion_point ?? '').toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.status && point.status !== filters.status) {
        return false;
      }
      if (filters.requestBy && point.request_by !== filters.requestBy) {
        return false;
      }
      return true;
    });
  }, [pointsProp, meetingPoints, filters.search, filters.status, filters.requestBy]);

  const pointsToLoad = pointsProp ?? meetingPoints;

  // Load issue counts and update counts for displayed points
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      const issueCountsData: Record<string, number> = {};
      const updateCountsData: Record<string, number> = {};
      try {
        for (const point of pointsToLoad) {
          if (cancelled) return;
          const [issues, updateCount] = await Promise.all([
            getIssueHistory(point.id),
            Promise.resolve(getUpdateCount(point.id))
          ]);
          if (cancelled) return;
          issueCountsData[point.id] = issues.length;
          updateCountsData[point.id] = updateCount;
        }
        if (!cancelled) {
          setIssueCounts(issueCountsData);
          setUpdateCounts(updateCountsData);
        }
      } catch (err) {
        logger.error('Error loading issue/update counts:', err);
        if (!cancelled) {
          setIssueCounts(prev => ({ ...prev }));
          setUpdateCounts(prev => ({ ...prev }));
        }
      }
    };

    if (pointsToLoad.length > 0) {
      loadCounts();
    }
    return () => { cancelled = true; };
  }, [pointsToLoad.length, pointsToLoad.map(p => p.id).join(','), getIssueHistory, getUpdateCount]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'Not Started': 'bg-orange-100 text-orange-700 border-orange-200',
      'On Going': 'bg-blue-100 text-blue-700 border-blue-200',
      'Completed': 'bg-green-100 text-green-700 border-green-200',
      'Rejected': 'bg-red-100 text-red-700 border-red-200',
      'Presented': 'bg-purple-100 text-purple-700 border-purple-200',
    };
    
    return (
      <Badge className={`${variants[status] || ''} px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap`}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleEdit = (point: MeetingPoint) => {
    setEditingPoint(point);
  };

  const handleDelete = (point: MeetingPoint) => {
    setDeletingPoint(point);
  };

  const handleShowHistory = (point: MeetingPoint) => {
    setHistoryPoint(point);
  };

  const handleShowIssues = async (point: MeetingPoint) => {
    setIssuesPoint(point);
    // Fetch issue count when opening dialog
    const issues = await getIssueHistory(point.id);
    setIssueCounts(prev => ({ ...prev, [point.id]: issues.length }));
  };

  const handleEditSuccess = async (id: string, data: Partial<MeetingPoint>) => {
    try {
      await updateMeetingPoint(id, data);
      setEditingPoint(null);
    } catch {
      // Context already shows toast; keep dialog open for retry
    }
  };

  const handleDeleteSuccess = async (id: string) => {
    try {
      await deleteMeetingPoint(id);
      setDeletingPoint(null);
    } catch {
      // Context already shows toast; keep dialog open for retry
    }
  };

  // Mobile Card View
  const MobileCardView = () => {
    if (filteredPoints.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex flex-col items-center">
            <Clock className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">No meeting points found</p>
            <p className="text-xs text-muted-foreground mt-1">Add a new discussion point to get started</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredPoints.map((point) => (
          <div
            key={point.id}
            className="bg-card border border-border rounded-lg p-2.5 space-y-1.5 hover:bg-muted/50 transition-colors"
          >
            {/* Header: Date and Status */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground font-medium">
                {formatDate(point.meeting_date)}
              </span>
              {getStatusBadge(point.status)}
            </div>

            {/* Discussion Point */}
            <div
              onClick={() => handleEdit(point)}
              className="text-sm font-medium text-foreground break-words cursor-pointer hover:text-primary transition-colors"
              title="Click to edit"
            >
              {point.discussion_point}
            </div>

            {/* Footer: Request By, Issues, Updates, Actions */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Request By */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{point.request_by || 'Unassigned'}</span>
                </div>

                {/* Issues Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowIssues(point);
                  }}
                  className="h-6 px-2 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-xs font-semibold bg-orange-100 text-orange-700 rounded-full w-4 h-4 flex items-center justify-center">
                    {issueCounts[point.id] ?? 0}
                  </span>
                </Button>

                {/* Updates Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowHistory(point);
                  }}
                  className="h-6 px-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-1"
                >
                  <History className="w-3 h-3" />
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full w-4 h-4 flex items-center justify-center">
                    {updateCounts[point.id] ?? 0}
                  </span>
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(point);
                  }}
                  className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(point);
                  }}
                  className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Desktop Table View
  const DesktopTableView = () => {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden h-full flex flex-col">
        <div className="overflow-x-auto overflow-y-auto seamless-scroll flex-1 min-h-0">
          <Table className="meeting-points-table">
            <TableHeader className="bg-muted/50 sticky top-0 z-20 shadow-sm safe-area-top">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}>
                  Date
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '400px', minWidth: '400px', maxWidth: '400px' }}>
                  Discussion Point
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                  Issues
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  Request By
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>
                  Status
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                  Updates
                </TableHead>
                <TableHead className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50" style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <Clock className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p>No meeting points found</p>
                      <p className="text-sm text-muted-foreground">Add a new discussion point to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPoints.map((point) => (
                  <TableRow key={point.id} className="hover:bg-muted/50">
                    <TableCell className="px-2 py-3 text-center text-sm text-foreground font-medium">
                      {formatDate(point.meeting_date)}
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div 
                        className="discussion-point-text"
                        onClick={() => handleEdit(point)}
                        title="Click to edit"
                      >
                        {point.discussion_point}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowIssues(point)}
                          className="h-8 px-2 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-semibold bg-orange-100 text-orange-700 rounded-full w-5 h-5 flex items-center justify-center">
                            {issueCounts[point.id] ?? 0}
                          </span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-foreground">
                        <User className="w-3 h-3" />
                        <span className="text-sm truncate">{point.request_by || 'Unassigned'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      {getStatusBadge(point.status)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowHistory(point)}
                          className="h-8 px-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-1"
                        >
                          <History className="w-4 h-4" />
                          <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center">
                            {updateCounts[point.id] ?? 0}
                          </span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(point)}
                          className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(point)}
                          className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden">
        <MobileCardView />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <DesktopTableView />
      </div>

      {/* Modals */}
      {editingPoint && (
        <EditMeetingPointDialog
          isOpen={!!editingPoint}
          onClose={() => setEditingPoint(null)}
          meetingPoint={editingPoint}
          onEditSuccess={handleEditSuccess}
        />
      )}

      {deletingPoint && (
        <DeleteMeetingPointDialog
          isOpen={!!deletingPoint}
          onClose={() => setDeletingPoint(null)}
          meetingPoint={deletingPoint}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}

      {historyPoint && (
        <UpdateHistoryDialog
          isOpen={!!historyPoint}
          onClose={() => setHistoryPoint(null)}
          discussionPoint={historyPoint.discussion_point ?? ''}
          meetingPointId={historyPoint.id}
        />
      )}

      {issuesPoint && (
        <IssuesDialog
          isOpen={!!issuesPoint}
          onClose={() => setIssuesPoint(null)}
          discussionPoint={issuesPoint.discussion_point ?? ''}
          meetingPointId={issuesPoint.id}
          onIssueCountChange={(count) => {
            setIssueCounts(prev => ({ ...prev, [issuesPoint.id]: count }));
          }}
        />
      )}
    </>
  );
};

export default MeetingPointsTable;

