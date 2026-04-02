import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, Clock, MapPin, TrendingUp } from 'lucide-react';
import { useEmployeeAttendanceStats } from '@/1-home/components/HomeOKRDashboard/component/SectionQuickMenuImport/useEmployeeAttendanceStats';
import { useQuery } from '@tanstack/react-query';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { attendanceLoadSectionIds, useReportAttendanceSection } from '@/2-3-attendance/context/AttendancePageLoadContext';

/** Recharts `fill` / `stroke`: pakai token HSL dari `index.css` */
const COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

export const AttendanceAnalyticsDashboard = () => {
  const { currentOrg } = useCurrentOrg();
  
  // Get real attendance stats
  const { data: attendanceStats, isPending: statsPending } = useEmployeeAttendanceStats();
  
  // Get weekly attendance data
  const { data: weeklyData = [], isPending: weeklyPending } = useQuery({
    queryKey: ['weekly-attendance-data', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(startOfWeek.getDate() + 6));
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          attendance_date,
          status,
          is_late
        `)
        .eq('organization_id', currentOrg.id)
        .gte('attendance_date', startOfWeek.toISOString().split('T')[0])
        .lte('attendance_date', endOfWeek.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      // Group by day and count statuses
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayNames.map((day, index) => {
        const dayRecords = data?.filter(record => 
          new Date(record.attendance_date).getDay() === index
        ) || [];
        
        return {
          day: day === 'Sun' ? 'Sun' : day === 'Mon' ? 'Mon' : day === 'Tue' ? 'Tue' : day === 'Wed' ? 'Wed' : day === 'Thu' ? 'Thu' : day === 'Fri' ? 'Fri' : 'Sat',
          present: dayRecords.filter(r => r.status === 'present').length,
          late: dayRecords.filter(r => r.is_late === true).length,
          absent: dayRecords.filter(r => r.status === 'absent').length
        };
      });
    },
    enabled: !!currentOrg?.id,
    ...attendanceHRQueryDefaults,
  });

  const analyticsLoading = statsPending || weeklyPending;
  useReportAttendanceSection(attendanceLoadSectionIds.dashboardAnalytics, analyticsLoading);
  
  // Calculate status distribution
  const statusData = [
    {
      name: 'Present',
      value: attendanceStats?.presentDays || 0,
      color: 'hsl(var(--success))',
    },
    {
      name: 'Late',
      value: attendanceStats?.lateDays || 0,
      color: 'hsl(var(--warning))',
    },
    {
      name: 'Leave',
      value: attendanceStats?.leaveDays || 0,
      color: 'hsl(var(--destructive))',
    },
  ];
  
  if (analyticsLoading) {
    return null;
  }
  return <div className="space-y-2">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceStats?.attendanceRate || 0}%</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceStats?.presentDays || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Days</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceStats?.lateDays || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceStats?.totalActiveEmployees || 0}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Weekly Attendance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
            <CardDescription>Attendance patterns for this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="present" fill="hsl(var(--success))" name="Present" />
                <Bar dataKey="late" fill="hsl(var(--warning))" name="Late" />
                <Bar dataKey="absent" fill="hsl(var(--destructive))" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Overall attendance status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({
                name,
                percent
              }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="hsl(var(--muted))" dataKey="value">
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance Table */}
      
    </div>;
};

