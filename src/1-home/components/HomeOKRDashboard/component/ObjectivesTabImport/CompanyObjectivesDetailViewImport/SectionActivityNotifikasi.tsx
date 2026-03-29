
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Bell, 
  Calendar, 
  CheckCircle, 
  Clock, 
  User, 
  MessageSquare,
  AlertTriangle,
  Info,
  ChevronRight,
  X
} from 'lucide-react';

export const SectionActivityNotifikasi = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Fetch real leave request data
  const { data: leaveRequests, isLoading } = useLeaveRequests({});

  // Convert leave requests to activity format
  const leaveActivities = React.useMemo(() => {
    if (!leaveRequests) return [];
    
    return leaveRequests.slice(0, 10).map((request) => ({
      id: request.id,
      type: 'leave_request',
      title: `Pengajuan Cuti ${request.leave_type === 'annual' ? 'Tahunan' : 
                              request.leave_type === 'sick' ? 'Sakit' :
                              request.leave_type === 'emergency' ? 'Darurat' : 
                              request.leave_type}`,
      description: `${request.employees?.full_name || 'Karyawan'} mengajukan cuti ${format(new Date(request.start_date), 'dd MMM', { locale: id })} - ${format(new Date(request.end_date), 'dd MMM yyyy', { locale: id })} (${request.total_days} hari)`,
      time: format(new Date(request.created_at), 'dd MMM yyyy HH:mm', { locale: id }),
      priority: request.status === 'pending' ? 'high' : 
                request.status === 'rejected' ? 'medium' : 'low',
      status: request.status,
      icon: Calendar,
      reason: request.reason,
      employee: request.employees?.full_name,
      department: request.employees?.departments?.name
    }));
  }, [leaveRequests]);

  // Mix leave requests with some mock system activities
  const activities = [...leaveActivities];

  const filters = [
    { id: 'all', label: 'Semua', count: activities.length },
    { id: 'pending', label: 'Menunggu', count: activities.filter(a => a.status === 'pending').length },
    { id: 'approved', label: 'Disetujui', count: activities.filter(a => a.status === 'approved').length },
    { id: 'rejected', label: 'Ditolak', count: activities.filter(a => a.status === 'rejected').length },
    { id: 'high', label: 'Prioritas Tinggi', count: activities.filter(a => a.priority === 'high').length }
  ];

  const filteredActivities = activities.filter(activity => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pending') return activity.status === 'pending';
    if (selectedFilter === 'approved') return activity.status === 'approved';
    if (selectedFilter === 'rejected') return activity.status === 'rejected';
    if (selectedFilter === 'high') return activity.priority === 'high';
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-border';
      case 'low': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu';
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      case 'cancelled': return 'Dibatalkan';
      case 'info': return 'Info';
      default: return status;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900 leading-snug flex items-center">
          <Bell className="h-4 w-4 mr-2 text-blue-600" />
          Aktivitas & Notifikasi
        </CardTitle>
        <Badge variant="secondary" className="text-xs font-medium leading-tight">
          {filteredActivities.length}
        </Badge>
        </div>
        
        {/* Filter Tabs with Horizontal Scroll - Made thinner */}
        <div className="mt-2 overflow-x-auto seamless-scroll horizontal-scroll">
          <div className="flex gap-1 min-w-max py-1">
            {filters.map((filter) => (
              <Button
                key={filter.id}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFilter(filter.id)}
                className={`text-xs font-medium h-6 px-2 whitespace-nowrap flex-shrink-0 leading-tight ${
                  selectedFilter === filter.id 
                    ? 'filter-button-active' 
                    : 'filter-button-hover'
                }`}
              >
                {filter.label}
                {filter.count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 h-3 px-1 text-xs font-medium leading-tight"
                  >
                    {filter.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        <ScrollArea className="flex-1 px-4 seamless-scroll">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-gray-500 leading-relaxed">Memuat data...</div>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                  <div className={`p-2 rounded-full border ${getPriorityColor(activity.priority)}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 leading-normal line-clamp-1">
                          {activity.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 leading-normal line-clamp-2">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500 leading-normal">
                            {activity.time}
                          </span>
                          <Badge 
                            className={`text-xs font-medium px-2 py-0 leading-tight ${getStatusColor(activity.status)}`}
                          >
                            {getStatusLabel(activity.status)}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </ScrollArea>
        
        {/* Action Footer */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full text-xs h-8">
            Lihat Semua Aktivitas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
