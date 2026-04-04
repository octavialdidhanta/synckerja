
import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/shared/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { 
  X, 
  Phone, 
  MessageCircle, 
  Calendar, 
  User, 
  MapPin, 
  Briefcase,
  Clock,
  FileText,
  Plus
} from 'lucide-react';
import { Lead, FollowUpHistory } from '@/shared/types/operationsConsultant';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

interface LeadDetailProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

export const LeadDetail: React.FC<LeadDetailProps> = ({ 
  lead, 
  onClose, 
  onUpdate 
}) => {
  const { data: employees = [] } = useAvailableEmployees();
  const [editedLead, setEditedLead] = useState<Lead>({ ...lead });
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUpHistory>>({
    tahap: 'F1',
    metode: 'Telepon',
    status: 'Berhasil',
    catatan: '',
    konsultan: lead.konsultan
  });

  const handleSave = () => {
    onUpdate({
      ...editedLead,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  const handleAddFollowUp = () => {
    const followUp: FollowUpHistory = {
      ...newFollowUp,
      id: Date.now().toString(),
      tanggal: new Date().toISOString(),
    } as FollowUpHistory;

    setEditedLead({
      ...editedLead,
      riwayatFollowUp: [...editedLead.riwayatFollowUp, followUp]
    });

    setNewFollowUp({
      tahap: 'F1',
      metode: 'Telepon',
      status: 'Berhasil',
      catatan: '',
      konsultan: lead.konsultan
    });

    setShowFollowUpForm(false);
  };

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

  const getFollowUpStatusColor = (status: string) => {
    switch (status) {
      case 'Berhasil': return 'bg-green-100 text-green-800';
      case 'Tidak Diangkat': return 'bg-yellow-100 text-yellow-800';
      case 'Sibuk': return 'bg-orange-100 text-orange-800';
      case 'Tidak Aktif': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detail Lead - {lead.namaPasien}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Patient Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Informasi Pasien
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="namaPasien">Nama Pasien</Label>
                  <Input
                    id="namaPasien"
                    value={editedLead.namaPasien}
                    onChange={(e) => setEditedLead({...editedLead, namaPasien: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jenisKelamin">Jenis Kelamin</Label>
                    <Select
                      value={editedLead.jenisKelamin}
                      onValueChange={(value: 'L' | 'P') => 
                        setEditedLead({...editedLead, jenisKelamin: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="umur">Umur</Label>
                    <Input
                      id="umur"
                      type="number"
                      value={editedLead.umur}
                      onChange={(e) => setEditedLead({...editedLead, umur: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pekerjaan">Pekerjaan</Label>
                  <Input
                    id="pekerjaan"
                    value={editedLead.pekerjaan}
                    onChange={(e) => setEditedLead({...editedLead, pekerjaan: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="domisili">Domisili</Label>
                  <Input
                    id="domisili"
                    value={editedLead.domisili}
                    onChange={(e) => setEditedLead({...editedLead, domisili: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informasi Lead
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="sumberLead">Sumber Lead</Label>
                  <Select
                    value={editedLead.sumberLead}
                    onValueChange={(value: any) => 
                      setEditedLead({...editedLead, sumberLead: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="Sosmed.Ads">Sosmed.Ads</SelectItem>
                      <SelectItem value="TICKETCODE">TICKETCODE</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="konsultan">Konsultan</Label>
                  <Select
                    value={editedLead.konsultan}
                    onValueChange={(value: any) => 
                      setEditedLead({...editedLead, konsultan: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.full_name || emp.email}>
                          {emp.full_name || emp.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="diagnosa">Diagnosa</Label>
                  <Select
                    value={editedLead.diagnosa}
                    onValueChange={(value: any) => 
                      setEditedLead({...editedLead, diagnosa: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kulit">Kulit</SelectItem>
                      <SelectItem value="Gigi">Gigi</SelectItem>
                      <SelectItem value="PMS">PMS</SelectItem>
                      <SelectItem value="Mata">Mata</SelectItem>
                      <SelectItem value="THT">THT</SelectItem>
                      <SelectItem value="Umum">Umum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="statusFollowUp">Status Follow Up</Label>
                  <Select
                    value={editedLead.statusFollowUp}
                    onValueChange={(value: any) => 
                      setEditedLead({...editedLead, statusFollowUp: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F1">F1</SelectItem>
                      <SelectItem value="F2">F2</SelectItem>
                      <SelectItem value="F3">F3</SelectItem>
                      <SelectItem value="Selesai">Selesai</SelectItem>
                      <SelectItem value="Tidak Respon">Tidak Respon</SelectItem>
                      <SelectItem value="Datang">Datang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="kategoriPasien">Kategori Pasien</Label>
                  <Select
                    value={editedLead.kategoriPasien}
                    onValueChange={(value: any) => 
                      setEditedLead({...editedLead, kategoriPasien: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efektif">Efektif</SelectItem>
                      <SelectItem value="Tidak Efektif">Tidak Efektif</SelectItem>
                      <SelectItem value="Diluar Layanan">Diluar Layanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Informasi Medis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="keluhan">Keluhan</Label>
                <Textarea
                  id="keluhan"
                  value={editedLead.keluhan}
                  onChange={(e) => setEditedLead({...editedLead, keluhan: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="keterangan">Keterangan</Label>
                <Textarea
                  id="keterangan"
                  value={editedLead.keterangan}
                  onChange={(e) => setEditedLead({...editedLead, keterangan: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="kesimpulanKonsultan">Kesimpulan Konsultan</Label>
                <Textarea
                  id="kesimpulanKonsultan"
                  value={editedLead.kesimpulanKonsultan}
                  onChange={(e) => setEditedLead({...editedLead, kesimpulanKonsultan: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Follow Up History */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Riwayat Follow Up
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFollowUpForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Follow Up
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {editedLead.riwayatFollowUp.map((followUp) => (
                  <div key={followUp.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getStatusColor(followUp.tahap)}`}>
                          {followUp.tahap}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {followUp.metode}
                        </Badge>
                        <Badge className={`text-xs ${getFollowUpStatusColor(followUp.status)}`}>
                          {followUp.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(followUp.tanggal).toLocaleDateString('id-ID')} - {followUp.konsultan}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{followUp.catatan}</p>
                  </div>
                ))}
                
                {editedLead.riwayatFollowUp.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Belum ada riwayat follow up
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Follow Up Form */}
        {showFollowUpForm && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Tambah Follow Up Baru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="newTahap">Tahap</Label>
                  <Select
                    value={newFollowUp.tahap}
                    onValueChange={(value: any) => 
                      setNewFollowUp({...newFollowUp, tahap: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F1">F1</SelectItem>
                      <SelectItem value="F2">F2</SelectItem>
                      <SelectItem value="F3">F3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="newMetode">Metode</Label>
                  <Select
                    value={newFollowUp.metode}
                    onValueChange={(value: any) => 
                      setNewFollowUp({...newFollowUp, metode: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Telepon">Telepon</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="newStatus">Status</Label>
                  <Select
                    value={newFollowUp.status}
                    onValueChange={(value: any) => 
                      setNewFollowUp({...newFollowUp, status: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Berhasil">Berhasil</SelectItem>
                      <SelectItem value="Tidak Diangkat">Tidak Diangkat</SelectItem>
                      <SelectItem value="Sibuk">Sibuk</SelectItem>
                      <SelectItem value="Tidak Aktif">Tidak Aktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="newCatatan">Catatan</Label>
                <Textarea
                  id="newCatatan"
                  value={newFollowUp.catatan}
                  onChange={(e) => setNewFollowUp({...newFollowUp, catatan: e.target.value})}
                  rows={3}
                  placeholder="Tambahkan catatan follow up..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddFollowUp}>
                  Simpan Follow Up
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowFollowUpForm(false)}
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} className="bg-[#2E5AAC] hover:bg-[#2E5AAC]/90">
            Simpan Perubahan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
