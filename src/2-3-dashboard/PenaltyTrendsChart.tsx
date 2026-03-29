
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAttendancePenalties } from './hooks/useAttendancePenalties';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';

export const PenaltyTrendsChart = () => {
  const { penalties, loading } = useAttendancePenalties();

  const chartData = useMemo(() => {
    if (!penalties.length) return [];

    // Get last 6 months
    const endDate = new Date();
    const startDate = subMonths(endDate, 5);
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthPenalties = penalties.filter(penalty => {
        const penaltyDate = new Date(penalty.applied_date);
        return penaltyDate >= monthStart && penaltyDate <= monthEnd;
      });

      const activePenalties = monthPenalties.filter(p => p.status === 'active').length;
      const waivedPenalties = monthPenalties.filter(p => p.status === 'waived').length;
      const totalAmount = monthPenalties
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + p.penalty_amount, 0);

      return {
        month: format(month, 'MMM yyyy', { locale: id }),
        shortMonth: format(month, 'MMM', { locale: id }),
        active: activePenalties,
        waived: waivedPenalties,
        total: monthPenalties.length,
        amount: totalAmount
      };
    });
  }, [penalties]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Penalty Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {/* Penalty Count Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Penalty Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="shortMonth" 
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'active' ? 'Active' : 
                  name === 'waived' ? 'Waived' : 'Total'
                ]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Bar dataKey="active" fill="#ef4444" name="active" />
              <Bar dataKey="waived" fill="#6b7280" name="waived" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Penalty Amount Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Penalty Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="shortMonth" 
                fontSize={12}
              />
              <YAxis 
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value) => [
                  `Rp ${Number(value).toLocaleString('id-ID')}`,
                  'Total Amount'
                ]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#f97316" 
                strokeWidth={2}
                dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
