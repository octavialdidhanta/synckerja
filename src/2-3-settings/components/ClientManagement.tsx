import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, Search, Building, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react';
import { useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { AttendanceSettingsHeaderActions } from '@/2-3-settings/components/AttendanceSettingsHeaderActions';
import { AddClientModal } from '../modals/AddClientModal';

export const ClientManagement = () => {
  const { clients, loading, refetch } = useClients();
  useReportAttendanceSettingsLoading(loading);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !selectedIndustry || client.industry === selectedIndustry;
    return matchesSearch && matchesIndustry;
  });

  const industries = [...new Set(clients.map((c) => c.industry).filter(Boolean))];

  if (loading) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AttendanceSettingsHeaderActions>
        <Button
          onClick={() => setShowAddModal(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </AttendanceSettingsHeaderActions>

      <div className="flex shrink-0 gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Industries</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>

      {filteredClients.length === 0 ? (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center rounded-lg border border-border text-center">
          <Building className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 text-base font-medium text-foreground">No Clients Found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || selectedIndustry
              ? 'No clients match your filters'
              : 'Add your first client to get started'}
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-medium text-foreground">{client.company_name}</h4>
                  {client.industry ? (
                    <Badge variant="secondary" className="text-xs">
                      {client.industry}
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {client.contact_person ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-3 w-3 shrink-0" />
                      <span>Contact: {client.contact_person}</span>
                    </div>
                  ) : null}

                  {client.contact_email ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span>{client.contact_email}</span>
                    </div>
                  ) : null}

                  {client.contact_phone ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{client.contact_phone}</span>
                    </div>
                  ) : null}

                  {client.address ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{client.address}</span>
                    </div>
                  ) : null}

                  {client.notes ? (
                    <div className="mt-1 text-sm italic text-muted-foreground">{client.notes}</div>
                  ) : null}
                </div>
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddClientModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onClientAdded={refetch}
      />
    </div>
  );
};
