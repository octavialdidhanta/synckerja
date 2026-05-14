
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Users, TrendingUp, Clock, Target, Phone, CheckCircle } from 'lucide-react';
import { Lead } from '@/shared/types/operationsConsultant';

interface CRMDashboardProps {
  leads: Lead[];
}

export const CRMDashboard: React.FC<CRMDashboardProps> = ({ leads }) => {
  const totalLeads = leads.length;
  const efektifLeads = leads.filter(lead => lead.kategoriPasien === 'Efektif').length;
  const pendingFollowUp = leads.filter(lead => ['F1', 'F2', 'F3'].includes(lead.statusFollowUp)).length;
  const conversionRate = totalLeads > 0 ? Math.round((efektifLeads / totalLeads) * 100) : 0;

  const sourceStats = leads.reduce((acc, lead) => {
    acc[lead.sumberLead] = (acc[lead.sumberLead] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const consultantStats = leads.reduce((acc, lead) => {
    acc[lead.konsultan] = (acc[lead.konsultan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const diagnosisStats = leads.reduce((acc, lead) => {
    acc[lead.diagnosa] = (acc[lead.diagnosa] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-2">
      {/* Key Metrics */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-brand-blue/20 bg-gradient-to-br from-brand-blue-soft to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-brand-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-blue">{totalLeads}</div>
            <p className="mt-1 text-xs text-brand-blue/80">
              Semua leads dalam sistem
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-red/20 bg-gradient-to-br from-brand-red/10 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-red">Leads Efektif</CardTitle>
            <CheckCircle className="h-4 w-4 text-brand-red" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-red">{efektifLeads}</div>
            <p className="mt-1 text-xs text-brand-red/80">
              Conversion rate: {conversionRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-blue/15 bg-gradient-to-br from-brand-blue-soft/80 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">Pending Follow Up</CardTitle>
            <Clock className="h-4 w-4 text-brand-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-blue">{pendingFollowUp}</div>
            <p className="mt-1 text-xs text-brand-blue/80">
              Memerlukan tindak lanjut
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-red/15 bg-gradient-to-br from-brand-red/10 to-brand-blue-soft/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-red">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-brand-red" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-red">{conversionRate}%</div>
            <p className="mt-1 text-xs text-brand-red/80">
              Tingkat keberhasilan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Stats */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {/* Source Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sumber Leads</CardTitle>
            <CardDescription>Distribusi berdasarkan sumber</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(sourceStats).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm font-medium">{source}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-brand-blue"
                      style={{ width: `${(count / totalLeads) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Consultant Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performa Konsultan</CardTitle>
            <CardDescription>Jumlah leads per konsultan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(consultantStats).map(([consultant, count]) => (
              <div key={consultant} className="flex items-center justify-between">
                <span className="text-sm font-medium">{consultant}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-brand-red"
                      style={{ width: `${(count / totalLeads) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Diagnosis Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Diagnosa Populer</CardTitle>
            <CardDescription>Distribusi keluhan pasien</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(diagnosisStats).map(([diagnosis, count]) => (
              <div key={diagnosis} className="flex items-center justify-between">
                <span className="text-sm font-medium">{diagnosis}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-brand-blue-deep"
                      style={{ width: `${(count / totalLeads) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aktivitas Terbaru</CardTitle>
          <CardDescription>5 leads terbaru yang ditambahkan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leads.slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-sm font-medium text-white">
                    {lead.namaPasien.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{lead.namaPasien}</p>
                    <p className="text-xs text-gray-600">{lead.diagnosa} • {lead.konsultan}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={
                      lead.kategoriPasien === 'Efektif' ? 'default' : 
                      lead.kategoriPasien === 'Tidak Efektif' ? 'destructive' : 
                      'secondary'
                    }
                  >
                    {lead.kategoriPasien}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">{new Date(lead.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
