import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { RefreshCw, Search, Filter, Calendar, Users } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/hooks/organized/utils';
import { CandidateQuickViewModal } from './CandidateQuickViewModal';
import { CandidateActionsDropdown } from './CandidateActionsDropdown';
import { formatToRupiah } from '@/utils/formatCurrency';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

interface JobApplication {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  birth_date?: string;
  gender?: string;
  nik?: string;
  cv_file_path: string | null;
  cover_letter: string | null;
  experience_years: string | null;
  expected_salary: string | null;
  skills: any;
  status: string;
  interview_status?: string | null;
  created_at: string;
  recruitment_token: string | null;
  job_opening_id: string;
  candidate_profile_id?: string;
  job_openings?: {
    job_title: string;
  };
}

export const CandidatesTable = () => {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching job applications...');
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          job_openings (
            job_title
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching applications:', error);
        throw error;
      }

      console.log('✅ Applications fetched successfully:', data);
      setApplications(data || []);
    } catch (error) {
      console.error('💥 Error in fetchApplications:', error);
      toast({
        title: "Error fetching applications",
        description: "Could not load job applications. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    try {
      console.log('🔄 Updating application status:', applicationId, newStatus);
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        console.error('❌ Error updating status:', error);
        throw error;
      }

      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));

      toast({
        title: "Status Updated",
        description: `Application status changed to ${newStatus}`
      });
      console.log('✅ Status updated successfully');
    } catch (error) {
      console.error('💥 Error updating status:', error);
      toast({
        title: "Update Error",
        description: "Could not update application status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleQuickView = (application: JobApplication) => {
    setSelectedApplication(application);
    setQuickViewOpen(true);
  };

  const handleCloseQuickView = () => {
    setQuickViewOpen(false);
    setSelectedApplication(null);
  };

  const downloadCV = async (filePath: string, applicantName: string) => {
    try {
      console.log('📥 Downloading CV from path:', filePath);
      const { data } = supabase.storage
        .from('recruitment-files')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Could not generate download URL');
      }

      const link = document.createElement('a');
      link.href = data.publicUrl;
      link.download = `CV_${applicantName.replace(/\s+/g, '_')}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ CV download initiated');
    } catch (error) {
      console.error('❌ Error downloading CV:', error);
      toast({
        title: "Download Error",
        description: "Could not download CV. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSendEmail = (application: JobApplication) => {
    const subject = `Follow-up: Application for ${application.job_openings?.job_title || 'Position'}`;
    const body = `Dear ${application.applicant_name},\n\nThank you for your application. We would like to schedule an interview with you.\n\nBest regards,\nHR Team`;
    window.open(`mailto:${application.applicant_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    updateApplicationStatus(application.id, 'contacted');
  };

  const handleSendWhatsApp = (application: JobApplication) => {
    const positionTitle = application.job_openings?.job_title || 'the position';
    const message = `*INTERVIEW INVITATION*
━━━━━━━━━━━━━━━━━━━━━━━━━

Dear *${application.applicant_name}*,

Thank you for your interest in the *${positionTitle}* position with our organization.

We have reviewed your application and would like to invite you for an interview to discuss your qualifications further.

**Next Steps:**
• Please confirm your availability for the interview
• We will schedule a convenient time for both parties
• Additional details will be provided upon confirmation

Best regards,
*HR Recruitment Team*

━━━━━━━━━━━━━━━━━━━━━━━━━
*Please reply to confirm your availability*`;

    const phoneNumber = application.applicant_phone?.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
    updateApplicationStatus(application.id, 'contacted');
  };

  const parseSkills = (skills: any) => {
    try {
      if (typeof skills === 'string') {
        return JSON.parse(skills);
      }
      return Array.isArray(skills) ? skills : [];
    } catch {
      return [];
    }
  };

  const handleStatusUpdate = (applicationId: string, newStatus: string) => {
    setApplications(prev => prev.map(app => 
      app.id === applicationId ? { ...app, status: newStatus } : app
    ));
  };

  const filteredApplications = applications.filter(application => {
    const matchesSearch = 
      application.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.applicant_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.job_openings?.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const computedStatus = (application.interview_status === 'scheduled' || application.interview_status === 'completed')
      ? application.interview_status!
      : application.status;
    const matchesStatus = statusFilter === 'all' || computedStatus === statusFilter;
    
    const matchesDate = dateFilter === 'all' ||
      (dateFilter === 'recent' && new Date(application.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (dateFilter === 'older' && new Date(application.created_at) <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Job Applications</h3>
            <p className="text-sm text-gray-600">
              Manage and review candidate applications
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="recent">Recent (7 days)</SelectItem>
                <SelectItem value="older">Older</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={fetchApplications}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500">
              <p className="text-lg font-medium">No applications found</p>
              <p className="text-sm mt-1">
                {applications.length === 0 
                  ? "Applications will appear here once candidates start applying" 
                  : "No applications match your current filters"}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold px-6 py-4">Candidate</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Position Applied</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Experience</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Expected Salary</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Skills</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Status</TableHead>
                    <TableHead className="font-semibold px-6 py-4">Applied</TableHead>
                    <TableHead className="font-semibold text-center px-6 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map(application => (
                    <TableRow key={application.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <TableCell className="px-6 py-4">
                        <div>
                          <p className="font-medium">{application.applicant_name}</p>
                          <p className="text-sm text-gray-600">{application.applicant_email}</p>
                          <p className="text-sm text-gray-600">{application.applicant_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {application.job_openings?.job_title || 'Position Applied'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {application.experience_years ? `${application.experience_years} years` : 'Not specified'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="font-medium text-green-600">
                          {formatToRupiah(application.expected_salary)}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {parseSkills(application.skills).slice(0, 2).map((skill: any, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {skill.title}
                            </Badge>
                          ))}
                          {parseSkills(application.skills).length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{parseSkills(application.skills).length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {['scheduled','completed'].includes(application.interview_status || '') ? (
                          <select
                            value={application.interview_status || 'scheduled'}
                            disabled
                            className="text-sm border rounded px-2 py-1 bg-gray-50 text-gray-600"
                          >
                            <option>{application.interview_status === 'scheduled' ? 'Scheduled' : 'Completed'}</option>
                          </select>
                        ) : (
                          <select 
                            value={application.status}
                            onChange={(e) => updateApplicationStatus(application.id, e.target.value)}
                            className="text-sm border rounded px-2 py-1 bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="contacted">Contacted</option>
                            <option value="rejected">Rejected</option>
                            <option value="hired">Hired</option>
                          </select>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="text-sm">
                          <div>{new Date(application.created_at).toLocaleDateString()}</div>
                          {application.recruitment_token && (
                            <div className="text-xs text-gray-500">via link</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <CandidateActionsDropdown 
                          onQuickView={() => handleQuickView(application)}
                          onDownloadCV={() => application.cv_file_path && downloadCV(application.cv_file_path, application.applicant_name)}
                          onSendEmail={() => handleSendEmail(application)}
                          onSendWhatsApp={() => handleSendWhatsApp(application)}
                          hasCV={!!application.cv_file_path}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </div>

      <CandidateQuickViewModal 
        application={selectedApplication}
        isOpen={quickViewOpen}
        onClose={handleCloseQuickView}
        onStatusUpdate={handleStatusUpdate}
      />
    </>
  );
};
