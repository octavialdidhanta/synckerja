
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, Search, Building, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react';
import { useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { AddClientModal } from './AddClientModal';

export const ClientManagement = () => {
  const { clients, loading, addClient, refetch } = useClients();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.contact_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !selectedIndustry || client.industry === selectedIndustry;
    return matchesSearch && matchesIndustry;
  });

  const industries = [...new Set(clients.map(c => c.industry).filter(Boolean))];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading clients...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Client Management</span>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Manage your clients and their locations for attendance tracking
              </p>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>

          {/* Client List */}
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Clients Found</h3>
              <p className="text-sm mb-4">
                {searchTerm || selectedIndustry ? 'No clients match your filters' : 'Add your first client to get started'}
              </p>
              <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-lg">{client.company_name}</h4>
                      {client.industry && (
                        <Badge variant="secondary" className="text-xs">
                          {client.industry}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {client.contact_person && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building className="h-3 w-3" />
                          <span>Contact: {client.contact_person}</span>
                        </div>
                      )}
                      
                      {client.contact_email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-3 w-3" />
                          <span>{client.contact_email}</span>
                        </div>
                      )}
                      
                      {client.contact_phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{client.contact_phone}</span>
                        </div>
                      )}
                      
                      {client.address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          <span>{client.address}</span>
                        </div>
                      )}
                      
                      {client.notes && (
                        <div className="text-sm text-gray-500 italic mt-2">
                          {client.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Summary Stats */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200 text-sm text-gray-600">
            <span>Total Clients: {clients.length}</span>
            <span>Active Clients: {clients.filter(c => c.is_active).length}</span>
          </div>
        </CardContent>
      </Card>

      <AddClientModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onClientAdded={refetch}
      />
    </>
  );
};
