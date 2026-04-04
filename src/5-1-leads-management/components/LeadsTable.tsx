
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { 
  Eye, 
  Edit, 
  Phone, 
  MessageCircle, 
  Calendar,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Lead } from '@/shared/types/operationsConsultant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface LeadsTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateLead: (lead: Lead) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({ 
  leads, 
  onSelectLead, 
  onUpdateLead 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedColumns, setSelectedColumns] = useState([
    'tanggal', 'namaPasien', 'sumberLead', 'konsultan', 'diagnosa', 
    'statusFollowUp', 'kategoriPasien', 'actions'
  ]);

  const totalPages = Math.ceil(leads.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentLeads = leads.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'F1': return 'bg-blue-100 text-blue-800';
      case 'F2': return 'bg-yellow-100 text-yellow-800';
      case 'F3': return 'bg-orange-100 text-orange-800';
      case 'Selesai': return 'bg-green-100 text-green-800';
      case 'Tidak Respon': return 'bg-red-100 text-red-800';
      case 'Datang': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getKategoriColor = (kategori: string) => {
    switch (kategori) {
      case 'Efektif': return 'bg-green-100 text-green-800 border-green-200';
      case 'Tidak Efektif': return 'bg-red-100 text-red-800 border-red-200';
      case 'Diluar Layanan': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleQuickAction = (lead: Lead, action: string) => {
    const updatedLead = { ...lead };
    
    switch (action) {
      case 'call':
        // Add call log to follow up history
        updatedLead.riwayatFollowUp = [
          ...lead.riwayatFollowUp,
          {
            id: Date.now().toString(),
            tahap: lead.statusFollowUp as 'F1' | 'F2' | 'F3',
            tanggal: new Date().toISOString(),
            metode: 'Telepon',
            status: 'Berhasil',
            catatan: 'Panggilan dilakukan',
            konsultan: lead.konsultan
          }
        ];
        break;
      case 'whatsapp':
        updatedLead.riwayatFollowUp = [
          ...lead.riwayatFollowUp,
          {
            id: Date.now().toString(),
            tahap: lead.statusFollowUp as 'F1' | 'F2' | 'F3',
            tanggal: new Date().toISOString(),
            metode: 'WhatsApp',
            status: 'Berhasil',
            catatan: 'Pesan WhatsApp dikirim',
            konsultan: lead.konsultan
          }
        ];
        break;
      case 'schedule':
        // Schedule follow up
        break;
    }
    
    onUpdateLead(updatedLead);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Daftar Leads</span>
          <div className="text-sm font-normal text-gray-600">
            {startIndex + 1}-{Math.min(endIndex, leads.length)} dari {leads.length} leads
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Tanggal</TableHead>
                <TableHead className="font-semibold">Nama Pasien</TableHead>
                <TableHead className="font-semibold">Sumber Lead</TableHead>
                <TableHead className="font-semibold">Konsultan</TableHead>
                <TableHead className="font-semibold">Diagnosa</TableHead>
                <TableHead className="font-semibold">Keluhan</TableHead>
                <TableHead className="font-semibold">Status Follow Up</TableHead>
                <TableHead className="font-semibold">Kategori</TableHead>
                <TableHead className="font-semibold text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  <TableCell className="font-medium">
                    {new Date(lead.tanggal).toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#2E5AAC] rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {lead.namaPasien.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{lead.namaPasien}</div>
                        <div className="text-xs text-gray-500">
                          {lead.jenisKelamin}, {lead.umur} tahun
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {lead.sumberLead}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">{lead.konsultan}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {lead.diagnosa}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate text-sm" title={lead.keluhan}>
                      {lead.keluhan}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getStatusColor(lead.statusFollowUp)}`}>
                      {lead.statusFollowUp}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getKategoriColor(lead.kategoriPasien)}`}>
                      {lead.kategoriPasien}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectLead(lead)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleQuickAction(lead, 'call')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Telepon
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction(lead, 'whatsapp')}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction(lead, 'schedule')}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Jadwal Follow Up
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSelectLead(lead)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Detail
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-gray-600">
              Halaman {currentPage} dari {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Selanjutnya
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
