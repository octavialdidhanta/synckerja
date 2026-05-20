import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Download, FileText, AlertCircle } from 'lucide-react';
import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { PurchaseRequestPDFGenerator } from './PurchaseRequestPDFGenerator';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { format } from 'date-fns';

interface PurchaseRequestPDFViewerProps {
  request: PurchaseRequest | null;
}

interface OrganizationData {
  company_name: string;
  address?: string | null;
  email?: string | null;
  phone_number?: string | null;
}

export const PurchaseRequestPDFViewer = ({ request }: PurchaseRequestPDFViewerProps) => {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { organizationId } = useCurrentOrg();

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!organizationId) return;
      
      try {
        const { data, error: orgError } = await supabase
          .from('organizations')
          .select('company_name, address, email, phone_number')
          .eq('id', organizationId)
          .single();

        if (orgError) throw orgError;
        if (data) {
          setOrganization(data);
        }
      } catch (err) {
        console.error('Error fetching organization data:', err);
        setError('Gagal memuat data organisasi');
      }
    };

    fetchOrganizationData();
  }, [organizationId]);

  useEffect(() => {
    const generatePDF = async () => {
      if (!request || !organization) return;

      setIsGenerating(true);
      setError(null);

      try {
        const generator = await PurchaseRequestPDFGenerator.create();
        const dataUrl = generator.generatePDF(request, organization);
        setPdfDataUrl(dataUrl);
      } catch (err) {
        console.error('Error generating PDF:', err);
        setError('Gagal menghasilkan PDF');
      } finally {
        setIsGenerating(false);
      }
    };

    if (request && organization) {
      generatePDF();
    }
  }, [request, organization]);

  const handleDownload = async () => {
    if (!request || !pdfDataUrl) return;

    try {
      const generator = await PurchaseRequestPDFGenerator.create();
      generator.generatePDF(request, organization!);
      const requestNumber = `PR-${request.id.substring(0, 8).toUpperCase()}-${format(new Date(request.created_at), 'yyyyMMdd')}`;
      const filename = `Surat-Permintaan-Pembelian-${requestNumber}.pdf`;
      generator.download(filename);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Gagal mengunduh PDF');
    }
  };

  if (!request) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Tidak ada data permintaan</p>
        </div>
      </div>
    );
  }

  // Check if data is complete - only required fields must be present
  // expected_outcome is optional, so we don't require it
  const checkField = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    return !!value;
  };

  const fieldChecks = {
    request_title: checkField(request.request_title),
    amount_idr: checkField(request.amount_idr),
    requester_name: checkField(request.requester_name),
    description: checkField(request.description),
    company_benefit: checkField(request.company_benefit),
  };

  const isDataComplete = !!(
    fieldChecks.request_title &&
    fieldChecks.amount_idr &&
    fieldChecks.requester_name &&
    fieldChecks.description &&
    fieldChecks.company_benefit
  );

  // Debug: Log missing fields
  if (!isDataComplete) {
    const missingFields = Object.entries(fieldChecks)
      .filter(([_, isValid]) => !isValid)
      .map(([field]) => field);
    console.log('Missing required fields for PDF:', missingFields);
    console.log('Request data:', {
      request_title: request.request_title,
      amount_idr: request.amount_idr,
      requester_name: request.requester_name,
      description: request.description,
      company_benefit: request.company_benefit,
    });
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Membuat dokumen PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 text-brand-red" />
          <p className="text-sm text-brand-red">{error}</p>
        </div>
      </div>
    );
  }

  if (!isDataComplete) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 mb-1 font-medium">
            Data belum lengkap
          </p>
          <p className="text-xs text-gray-500">
            Silakan lengkapi semua informasi yang diperlukan (judul, jumlah, pemohon, deskripsi, dan manfaat perusahaan) untuk menghasilkan dokumen PDF.
          </p>
        </div>
      </div>
    );
  }

  if (!pdfDataUrl) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-gray-600">Mempersiapkan dokumen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Download Button */}
      <div className="flex justify-end mb-2 pb-2 border-b">
        <Button
          onClick={handleDownload}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Unduh PDF
        </Button>
      </div>

      {/* PDF Preview */}
      <div className="flex-1 overflow-auto border rounded-md bg-gray-50">
        <iframe
          src={pdfDataUrl}
          className="w-full h-full min-h-[600px] border-0"
          title="PDF Preview"
        />
      </div>
    </div>
  );
};
