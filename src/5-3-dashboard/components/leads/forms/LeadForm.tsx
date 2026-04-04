
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Lead } from '@/shared/types/operationsConsultant';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => void;
  lead?: Lead;
}

export const LeadForm = ({ open, onClose, onSubmit, lead }: LeadFormProps) => {
  const { data: employees = [] } = useAvailableEmployees();
  const [formData, setFormData] = useState({
    ticketId: lead?.ticketId || '',
    client: lead?.client || lead?.namaPasien || '',
    phoneNumber: lead?.phoneNumber || '',
    sex: lead?.sex || lead?.jenisKelamin || 'L',
    age: lead?.age || lead?.umur || 0,
    address: lead?.address || lead?.domisili || '',
    occupation: lead?.occupation || lead?.pekerjaan || '',
    title: lead?.title || lead?.diagnosa || '',
    feedbackComplaint: lead?.feedbackComplaint || lead?.keluhan || '',
    category: lead?.category || lead?.kategoriPasien || '',
    assignee: lead?.assignee || lead?.konsultan || '',
    followup: lead?.followup || 0,
    fuPriority: lead?.fuPriority || 'Medium',
    status: lead?.status || 'Open',
    source: lead?.source || 'Website',
    createdBy: lead?.createdBy || 'System',
    lastUpdatedBy: lead?.lastUpdatedBy || '',
    lastUpdatedByName: lead?.lastUpdatedByName || '',
    resolutionNotes: lead?.resolutionNotes || '',
    // Legacy fields for compatibility
    tanggal: lead?.tanggal || new Date().toISOString().split('T')[0],
    sumberLead: (lead?.sumberLead as any) || 'Website',
    konsultan: (lead?.konsultan as any) || '',
    namaAdmin: lead?.namaAdmin || 'System',
    namaPasien: lead?.namaPasien || '',
    jenisKelamin: (lead?.jenisKelamin as any) || 'L',
    umur: lead?.umur || 0,
    pekerjaan: lead?.pekerjaan || '',
    domisili: lead?.domisili || '',
    diagnosa: (lead?.diagnosa as any) || 'Umum',
    keluhan: lead?.keluhan || '',
    kategoriPasien: (lead?.kategoriPasien as any) || 'Efektif',
    statusFollowUp: (lead?.statusFollowUp as any) || 'F1',
    keterangan: lead?.keterangan || '',
    kesimpulanKonsultan: lead?.kesimpulanKonsultan || '',
    statusRespon: (lead?.statusRespon as any) || 'Respon',
    tags: lead?.tags || [],
    riwayatFollowUp: lead?.riwayatFollowUp || [],
    progress: lead?.progress || []
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Client Name</Label>
              <Input
                id="client"
                value={formData.client}
                onChange={(e) => handleInputChange('client', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sex">Gender</Label>
              <Select value={formData.sex} onValueChange={(value) => handleInputChange('sex', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Male</SelectItem>
                  <SelectItem value="P">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={formData.assignee || ''} onValueChange={(value) => handleInputChange('assignee', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => handleInputChange('occupation', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title/Diagnosis</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="feedbackComplaint">Complaint/Feedback</Label>
            <Textarea
              id="feedbackComplaint"
              value={formData.feedbackComplaint}
              onChange={(e) => handleInputChange('feedbackComplaint', e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="fuPriority">FU Priority</Label>
              <Select value={formData.fuPriority} onValueChange={(value) => handleInputChange('fuPriority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Closed">Resolve</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source">Source</Label>
              <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Chat">Chat</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="followup">Follow Up Count</Label>
              <Input
                id="followup"
                type="number"
                value={formData.followup}
                onChange={(e) => handleInputChange('followup', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="resolutionNotes">Resolution Notes</Label>
            <Textarea
              id="resolutionNotes"
              value={formData.resolutionNotes}
              onChange={(e) => handleInputChange('resolutionNotes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
