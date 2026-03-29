import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, Clock, TrendingUp, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'present' | 'absent' | 'late' | 'early_leave';
  workingHours: string;
  overtime: string;
  notes?: string;
}

interface AttendanceHistoryProps {
  employeeId: string;
  employeeName?: string;
}

export const AttendanceHistory = ({ employeeId, employeeName }: AttendanceHistoryProps) => {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Mock data - in real app, this would come from API
  const mockAttendanceData: AttendanceRecord[] = [
    {
      id: '1',
      date: '2024-01-15',
      checkIn: '08:00',
      checkOut: '17:30',
      status: 'present',
      workingHours: '8h 30m',
      overtime: '0h 30m'
    },
    {
      id: '2',
      date: '2024-01-14',
      checkIn: '08:15',
      checkOut: '17:00',
      status: 'late',
      workingHours: '8h 45m',
      overtime: '0h'
    },
    {
      id: '3',
      date: '2024-01-13',
      checkIn: null,
      checkOut: null,
      status: 'absent',
      workingHours: '0h',
      overtime: '0h',
      notes: 'Sick leave'
    },
    {
      id: '4',
      date: '2024-01-12',
      checkIn: '08:00',
      checkOut: '16:30',
      status: 'early_leave',
      workingHours: '7h 30m',
      overtime: '0h',
      notes: 'Personal appointment'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'early_leave':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4" />;
      case 'late':
        return <AlertCircle className="h-4 w-4" />;
      case 'absent':
        return <XCircle className="h-4 w-4" />;
      case 'early_leave':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Hadir';
      case 'late':
        return 'Terlambat';
      case 'absent':
        return 'Tidak Hadir';
      case 'early_leave':
        return 'Pulang Awal';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid Date';
    
    try {
      // Try different date formats
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Try parsing as ISO date format (YYYY-MM-DD)
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateString.split('-');
          const validDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          if (!isNaN(validDate.getTime())) {
            return validDate.toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }
        return dateString; // Return original string if all parsing fails
      }
      
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'for date:', dateString);
      return dateString; // Return original string if formatting fails
    }
  };

  // Calculate monthly statistics
  const monthlyStats = {
    totalDays: mockAttendanceData.length,
    presentDays: mockAttendanceData.filter(record => record.status === 'present').length,
    lateDays: mockAttendanceData.filter(record => record.status === 'late').length,
    absentDays: mockAttendanceData.filter(record => record.status === 'absent').length,
    averageWorkingHours: '8h 15m'
  };

  return (
    <div className="space-y-6">
      {/* Header with employee info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Riwayat Kehadiran</h2>
            <p className="text-gray-600">{employeeName || 'Karyawan'}</p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex space-x-2">
          <Button
            variant={viewMode === 'daily' ? 'default' : 'outline'}
            onClick={() => setViewMode('daily')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Harian
          </Button>
          <Button
            variant={viewMode === 'monthly' ? 'default' : 'outline'}
            onClick={() => setViewMode('monthly')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Bulanan
          </Button>
        </div>
      </div>

      {/* Monthly Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hari Kerja</p>
                <p className="text-2xl font-bold text-gray-900">{monthlyStats.totalDays}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hari Hadir</p>
                <p className="text-2xl font-bold text-green-600">{monthlyStats.presentDays}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hari Terlambat</p>
                <p className="text-2xl font-bold text-yellow-600">{monthlyStats.lateDays}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hari Tidak Hadir</p>
                <p className="text-2xl font-bold text-red-600">{monthlyStats.absentDays}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Detail Kehadiran Harian</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAttendanceData.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(record.status)}
                    <Badge className={`${getStatusColor(record.status)} border`}>
                      {formatStatusText(record.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{formatDate(record.date)}</p>
                    {record.notes && (
                      <p className="text-sm text-gray-600">{record.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div className="text-center">
                    <p className="font-medium">Masuk</p>
                    <p>{record.checkIn || '-'}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Keluar</p>
                    <p>{record.checkOut || '-'}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Jam Kerja</p>
                    <p>{record.workingHours}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Lembur</p>
                    <p>{record.overtime}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
