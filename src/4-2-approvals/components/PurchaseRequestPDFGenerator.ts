import jsPDF from 'jspdf';
import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/utils/formatCurrency';
import { format } from 'date-fns';

interface OrganizationData {
  company_name: string;
  address?: string | null;
  email?: string | null;
  phone_number?: string | null;
}

export class PurchaseRequestPDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;
  private currentY: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.currentY = this.margin;
  }

  private checkPageBreak(neededSpace: number = 20): void {
    if (this.currentY + neededSpace > this.pageHeight - 30) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private addWatermark(): void {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setTextColor(200, 200, 200);
      this.doc.setFontSize(60);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('DOKUMEN RESMI', this.pageWidth / 2, this.pageHeight / 2, {
        align: 'center',
        angle: 45,
        opacity: 0.1
      });
      this.doc.setTextColor(0, 0, 0);
    }
  }

  private getDocumentTitle(requestType?: string | null): string {
    switch (requestType) {
      case 'purchase':
        return 'SURAT PERMINTAAN PEMBELIAN';
      case 'reimbursement':
        return 'SURAT PERMINTAAN REIMBURSEMENT';
      case 'cash_advance':
        return 'SURAT PERMINTAAN CASH ADVANCE';
      case 'loan':
        return 'SURAT PERMINTAAN PINJAMAN';
      default:
        return 'SURAT PERMINTAAN';
    }
  }

  private getPerihalPrefix(requestType?: string | null): string {
    switch (requestType) {
      case 'purchase':
        return 'Permintaan Pembelian';
      case 'reimbursement':
        return 'Permintaan Reimbursement';
      case 'cash_advance':
        return 'Permintaan Cash Advance';
      case 'loan':
        return 'Permintaan Pinjaman';
      default:
        return 'Permintaan';
    }
  }

  private addHeader(organization: OrganizationData, requestNumber: string, requestDate: string, requestTitle?: string, requestType?: string | null): void {
    // Document Title - Centered (di bagian atas)
    const documentTitle = this.getDocumentTitle(requestType);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(documentTitle, this.pageWidth / 2, this.currentY, {
      align: 'center'
    });
    this.currentY += 8;

    // Company Name and Address - Left aligned, di bawah judul, huruf kecil
    const leftStartY = this.currentY;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(organization.company_name, this.margin, this.currentY);
    
    // Nomor dan Tanggal - Right aligned, sejajar dengan company name
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Nomor: ${requestNumber}`, this.pageWidth - this.margin, leftStartY, {
      align: 'right'
    });
    this.doc.text(`Tanggal: ${requestDate}`, this.pageWidth - this.margin, leftStartY + 5, {
      align: 'right'
    });
    
    // Company Address
    if (organization.address) {
      this.currentY += 5;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const addressLines = this.doc.splitTextToSize(organization.address, 80);
      addressLines.forEach((line: string) => {
        this.doc.text(line, this.margin, this.currentY);
        this.currentY += 4;
      });
    }

    // Company Contact - Left aligned, langsung di bawah alamat (spacing sedang)
    if (organization.email) {
      this.currentY += 4;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Email: ${organization.email}`, this.margin, this.currentY);
    }
    if (organization.phone_number) {
      this.currentY += 4;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Telp: ${organization.phone_number}`, this.margin, this.currentY);
    }

    // Perihal - Left aligned, di bawah Email dan Telp
    if (requestTitle) {
      this.currentY += 4;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      const perihalPrefix = this.getPerihalPrefix(requestType);
      const perihalText = `Perihal: ${perihalPrefix} - ${requestTitle}`;
      const perihalLines = this.doc.splitTextToSize(perihalText, 80);
      perihalLines.forEach((line: string) => {
        this.doc.text(line, this.margin, this.currentY);
        this.currentY += 4;
      });
    }

    // Tambahkan jarak sebelum konten utama
    this.currentY += 8;
    // Perihal akan ditambahkan di generatePDF setelah request title tersedia
  }

  private addFormalParagraph(text: string, indent: number = 0): void {
    this.checkPageBreak(15);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    
    const lines = this.doc.splitTextToSize(text, this.contentWidth - indent);
    lines.forEach((line: string, index: number) => {
      this.doc.text(line, this.margin + indent, this.currentY);
      this.currentY += 5;
    });
    this.currentY += 3;
  }

  private addFormalField(label: string, value: string | number | null | undefined, indent: number = 0, compact: boolean = false): void {
    this.checkPageBreak(10);
    if (value === null || value === undefined || value === '') return;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    
    const valueStr = typeof value === 'number' ? formatToRupiah(value) : String(value);
    const text = `${label}: ${valueStr}`;
    const lines = this.doc.splitTextToSize(text, this.contentWidth - indent);
    lines.forEach((line: string) => {
      this.doc.text(line, this.margin + indent, this.currentY);
      this.currentY += 5;
    });
    // Kurangi spacing jika compact mode
    this.currentY += compact ? 0 : 2;
  }

  private addFormalSection(title: string, content: string, indent: number = 0): void {
    this.checkPageBreak(20);
    
    // Section title
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin + indent, this.currentY);
    this.currentY += 6;
    
    // Section content
    this.addFormalParagraph(content, indent + 5);
  }


  private addSignatureSection(requesterName: string, approvedBy?: string): void {
    // Ensure we have enough space for signature section
    // Cek apakah masih ada ruang yang cukup di halaman saat ini
    // Kurangi signatureSpace menjadi lebih kecil untuk lebih fleksibel
    const signatureSpace = 45; // Dikurangi dari 60 menjadi 45
    const availableSpace = this.pageHeight - this.currentY - 40; // 40 untuk margin bawah
    
    // Hanya pindah ke halaman baru jika benar-benar tidak ada ruang yang cukup
    if (availableSpace < signatureSpace) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
    
    // Kurangi spacing sebelum signature section
    // Tambah spacing sebelum signature section untuk menggeser label ke bawah
    this.currentY += 10; // Ditambah dari 3 menjadi 10 untuk menggeser label ke bawah
    
    const signatureY = this.currentY;
    const leftX = this.margin; // Pemohon di kiri
    const rightX = this.pageWidth - this.margin; // Disetujui di kanan
    const lineWidth = 70;
    const centerX = this.pageWidth / 2; // Pemisah di tengah
    
    // Requester Signature (Left)
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Pemohon,', leftX, signatureY);
    // Geser garis ke bawah lagi - tambah jarak antara label dan garis dari 30 menjadi 40
    const requesterLineY = signatureY + 40;
    this.doc.setLineWidth(0.5);
    // Garis pemohon hanya sampai sebelum tengah
    this.doc.line(leftX, requesterLineY, Math.min(leftX + lineWidth, centerX - 20), requesterLineY);
    this.doc.setFont('helvetica', 'bold');
    // Kurangi jarak antara garis dan nama dari 6 menjadi 4
    this.doc.text(requesterName, leftX, requesterLineY + 4);
    
    // Approver Signature (Right - selalu ditampilkan)
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Disetujui,', rightX, signatureY, { align: 'right' });
    // Geser garis ke bawah lagi - tambah jarak antara label dan garis dari 30 menjadi 40
    const approverLineY = signatureY + 40;
    // Garis disetujui mulai dari setelah tengah
    const approverLineStart = Math.max(rightX - lineWidth, centerX + 20);
    this.doc.line(approverLineStart, approverLineY, rightX, approverLineY);
    if (approvedBy) {
      this.doc.setFont('helvetica', 'bold');
      // Kurangi jarak antara garis dan nama dari 6 menjadi 4
      this.doc.text(approvedBy, approverLineStart, approverLineY + 4);
    }
    
    // Kurangi spacing setelah signature dari 50 menjadi 35
    this.currentY = signatureY + 35;
  }

  private addFooter(): void {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);
      this.doc.text(
        `Halaman ${i} dari ${pages} | Dokumen ini dibuat secara elektronik dan memiliki kekuatan hukum yang sama dengan dokumen tertulis`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }
  }

  generatePDF(
    request: PurchaseRequest,
    organization: OrganizationData
  ): string {
    // Reset position
    this.currentY = this.margin;
    
    // Generate request number and date
    const requestNumber = `PR-${request.id.substring(0, 8).toUpperCase()}-${format(new Date(request.created_at), 'yyyyMMdd')}`;
    const requestDate = format(new Date(request.created_at), 'dd MMMM yyyy');
    
    // Check if data is complete - only required fields must be present
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

    const isDataComplete = !!(
      checkField(request.request_title) &&
      checkField(request.amount_idr) &&
      checkField(request.requester_name) &&
      checkField(request.description) &&
      checkField(request.company_benefit)
    );
    
    // Header with letterhead
    this.addHeader(organization, requestNumber, requestDate, request.request_title, request.request_type);
    
    if (!isDataComplete) {
      // Show message if data is incomplete
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(150, 150, 150);
      this.addFormalParagraph(
        'Data permintaan belum lengkap. Silakan lengkapi semua informasi yang diperlukan untuk menghasilkan dokumen PDF.'
      );
      this.addFooter();
      return this.doc.output('datauristring');
    }
    
    // Kepada/Yth (optional - bisa ditambahkan jika diperlukan)
    // this.addFormalField('Kepada', 'Yth. [Nama Penerima]');
    // this.currentY += 5;
    
    // Perihal - Left aligned, di bawah alamat perusahaan
    // Perihal sudah ditambahkan di header, jadi tidak perlu ditambahkan lagi di sini
    // currentY sudah diupdate di header
    
    // Tambahkan jarak sebelum "Dengan hormat" agar tidak terlalu dekat dengan Perihal di header
    this.currentY += 12;
    
    // Isi Surat - Pendahuluan
    this.addFormalParagraph(
      `Dengan hormat,`
    );
    this.currentY += 3;
    
    // Sesuaikan teks pembuka berdasarkan request type dan type spesifik
    const getOpeningText = (request: PurchaseRequest): string => {
      const requestType = request.request_type;
      
      if (requestType === 'purchase') {
        const purchaseType = request.purchase_type;
        if (!purchaseType) {
          return 'permintaan pembelian';
        }
        
        const typeMap: Record<string, string> = {
          'Physical Item': 'permintaan pembelian barang',
          'Google Ads Budget': 'permintaan pembelian budget iklan Google Ads',
          'Meta/Facebook Ads Budget': 'permintaan pembelian budget iklan Meta/Facebook',
          'Software/Subscription': 'permintaan pembelian software/subscription',
          'Service': 'permintaan pembelian layanan',
          'Other': 'permintaan pembelian'
        };
        
        return typeMap[purchaseType] || 'permintaan pembelian';
      } else if (requestType === 'reimbursement') {
        const reimbursementType = request.reimbursement_type;
        if (reimbursementType) {
          return `permintaan reimbursement ${reimbursementType.toLowerCase()}`;
        }
        return 'permintaan reimbursement';
      } else if (requestType === 'cash_advance') {
        const advanceType = request.purchase_type; // advance_type disimpan di purchase_type
        if (advanceType) {
          return `permintaan cash advance untuk ${advanceType.toLowerCase()}`;
        }
        return 'permintaan cash advance';
      } else if (requestType === 'loan') {
        return 'permintaan pinjaman';
      }
      
      return 'permintaan';
    };
    
    const openingText = getOpeningText(request);
    this.addFormalParagraph(
      `Berdasarkan kebutuhan operasional perusahaan, dengan ini kami mengajukan ${openingText} sebagai berikut:`
    );
    this.currentY += 5;
    
    // Detail khusus berdasarkan request type
    let detailCounter = 1;
    
    if (request.request_type === 'purchase') {
      // Detail Pembelian - Dipindahkan ke atas nomor 1-5
      if (request.vendor_name || request.purchase_type || request.purchase_link) {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Detail Pembelian:', this.margin, this.currentY);
        this.currentY += 5;
        if (request.vendor_name) {
          this.addFormalField('Vendor', request.vendor_name, 0);
        }
        if (request.purchase_type) {
          this.addFormalField('Jenis Pembelian', request.purchase_type, 0);
        }
        if (request.purchase_link) {
          this.addFormalField('Link Pembelian', request.purchase_link, 0);
        }
        this.currentY += 3;
      }
    } else if (request.request_type === 'reimbursement') {
      // Untuk reimbursement, detail diintegrasikan ke dalam nomor 1-4
      // Tidak perlu section terpisah "Detail Reimbursement"
    } else if (request.request_type === 'cash_advance') {
      // Detail Cash Advance
      const advanceType = request.purchase_type; // advance_type disimpan di purchase_type
      const urgencyLevel = request.productivity_impact; // urgency_level disimpan di productivity_impact
      const projectName = request.vendor_name; // project_name disimpan di vendor_name
      const expectedExpenses = request.business_purpose; // expected_expenses disimpan di business_purpose
      
      // Parse expected_outcome untuk mendapatkan expected_return_date dan repayment_method
      let expectedReturnDate = '';
      let repaymentMethod = '';
      if (request.expected_outcome) {
        const outcomeParts = request.expected_outcome.split('.');
        outcomeParts.forEach(part => {
          if (part.includes('Expected return date')) {
            expectedReturnDate = part.split(':')[1]?.trim() || '';
          }
          if (part.includes('Repayment method')) {
            repaymentMethod = part.split(':')[1]?.trim() || '';
          }
        });
      }
      
      if (advanceType || urgencyLevel || expectedReturnDate || repaymentMethod || projectName || expectedExpenses) {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Detail Cash Advance:', this.margin, this.currentY);
        this.currentY += 5;
        if (advanceType) {
          this.addFormalField('Jenis Cash Advance', advanceType, 0);
        }
        if (urgencyLevel) {
          this.addFormalField('Tingkat Urgensi', urgencyLevel, 0);
        }
        if (projectName) {
          this.addFormalField('Nama Proyek', projectName, 0);
        }
        if (expectedReturnDate) {
          this.addFormalField('Tanggal Pengembalian yang Diharapkan', expectedReturnDate, 0);
        }
        if (repaymentMethod) {
          this.addFormalField('Metode Pembayaran Kembali', repaymentMethod, 0);
        }
        if (expectedExpenses) {
          this.addFormalField('Pengeluaran yang Diharapkan', expectedExpenses, 0);
        }
        this.currentY += 3;
      }
    } else if (request.request_type === 'loan') {
      // Detail Loan
      // repayment_plan mungkin ada di expected_outcome atau business_purpose
      const repaymentPlan = request.expected_outcome || request.business_purpose;
      
      if (repaymentPlan) {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Detail Pinjaman:', this.margin, this.currentY);
        this.currentY += 5;
        this.addFormalField('Rencana Pembayaran Kembali', repaymentPlan, 0);
        this.currentY += 3;
      }
    }
    
    // Detail Permintaan dalam format formal (lebih rapat dan profesional)
    this.addFormalField(`${detailCounter++}. Perihal`, request.request_title, 0, true);
    this.addFormalField(`${detailCounter++}. Nilai`, formatToRupiah(request.amount_idr), 0, true);
    this.addFormalField(`${detailCounter++}. Pemohon`, request.requester_name, 0, true);
    if (request.department_name) {
      this.addFormalField(`${detailCounter++}. Departemen`, request.department_name, 0, true);
    }
    
    // Detail khusus untuk Reimbursement - diintegrasikan ke dalam nomor
    if (request.request_type === 'reimbursement') {
      if (request.reimbursement_type) {
        this.addFormalField(`${detailCounter++}. Jenis Reimbursement`, request.reimbursement_type, 0, true);
      }
      if (request.expense_date) {
        this.addFormalField(`${detailCounter++}. Tanggal Pengeluaran`, format(new Date(request.expense_date), 'dd MMMM yyyy'), 0, true);
      }
      if (request.merchant_name) {
        this.addFormalField(`${detailCounter++}. Merchant/Toko`, request.merchant_name, 0, true);
      }
      if (request.receipt_number) {
        this.addFormalField(`${detailCounter++}. Nomor Struk/Kwitansi`, request.receipt_number, 0, true);
      }
      if (request.original_receipt_amount) {
        this.addFormalField(`${detailCounter++}. Nilai Asli Struk`, request.original_receipt_amount, 0, true);
      }
      if (request.exchange_rate && request.exchange_rate !== '1') {
        this.addFormalField(`${detailCounter++}. Kurs`, request.exchange_rate, 0, true);
      }
    }
    
    if (request.is_recurring && request.recurring_frequency) {
      this.addFormalField(`${detailCounter++}. Frekuensi Pembayaran`, request.recurring_frequency, 0, true);
    }
    
    // Tambahkan informasi bank untuk reimbursement, cash advance, dan loan
    if ((request.request_type === 'reimbursement' || request.request_type === 'cash_advance' || request.request_type === 'loan') && 
        (request.bank_account_number || request.bank_account_name || request.bank_name)) {
      this.currentY += 3;
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Informasi Rekening:', this.margin, this.currentY);
      this.currentY += 5;
      if (request.bank_name) {
        this.addFormalField('Nama Bank', request.bank_name, 0, true);
      }
      if (request.bank_account_name) {
        this.addFormalField('Nama Pemilik Rekening', request.bank_account_name, 0, true);
      }
      if (request.bank_account_number) {
        this.addFormalField('Nomor Rekening', request.bank_account_number, 0, true);
      }
    }
    
    this.currentY += 5;
    
    // Deskripsi Permintaan (gabungkan deskripsi dan manfaat tanpa label terpisah)
    this.checkPageBreak(20);
    
    // Section title
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Deskripsi Permintaan:', this.margin, this.currentY);
    this.currentY += 6;
    
    // Gabungkan deskripsi dan manfaat tanpa label "Manfaat bagi Perusahaan"
    // Gunakan satu newline saja untuk spacing yang lebih rapat
    const descriptionText = request.company_benefit 
      ? `${request.description}\n${request.company_benefit}`
      : request.description;
    
    // Section content tanpa indentasi dengan spacing lebih rapat
    this.checkPageBreak(15);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    
    const lines = this.doc.splitTextToSize(descriptionText, this.contentWidth - 0);
    lines.forEach((line: string, index: number) => {
      this.doc.text(line, this.margin + 0, this.currentY);
      // Kurangi spacing antar baris menjadi 4px (lebih rapat dari default 5px)
      this.currentY += 4;
    });
    
    // Expected Outcome (if available)
    if (request.expected_outcome && request.expected_outcome.trim()) {
      this.addFormalSection('Hasil yang Diharapkan:', request.expected_outcome);
    }
    
    // Penutup
    this.currentY += 3;
    this.addFormalParagraph(
      `Demikian permintaan ini kami sampaikan. Atas perhatian dan persetujuan Bapak/Ibu, kami ucapkan terima kasih.`
    );
    // Kurangi spacing setelah penutup agar tanda tangan bisa lebih dekat
    this.currentY += 3;
    
    // Status Persetujuan (jika sudah ada)
    if (request.status === 'approved' || request.status === 'rejected') {
      this.currentY += 5;
      this.doc.setLineWidth(0.5);
      this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
      this.currentY += 8;
      
      let statusText = '';
      let statusColor: [number, number, number] = [0, 0, 0];
      
      switch (request.status) {
        case 'approved':
          statusText = 'DISETUJUI';
          statusColor = [34, 197, 94];
          break;
        case 'rejected':
          statusText = 'DITOLAK';
          statusColor = [239, 68, 68];
          break;
      }
      
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      this.doc.text(`Status: ${statusText}`, this.margin, this.currentY);
      this.doc.setTextColor(0, 0, 0);
      this.currentY += 8;
      
      if (request.approved_by_name && request.approved_at) {
        this.addFormalField('Disetujui Oleh', request.approved_by_name);
        this.addFormalField('Tanggal Persetujuan', format(new Date(request.approved_at), 'dd MMMM yyyy, HH:mm'));
      }
      
      if (request.rejected_by_name && request.rejected_at) {
        this.addFormalField('Ditolak Oleh', request.rejected_by_name);
        this.addFormalField('Tanggal Penolakan', format(new Date(request.rejected_at), 'dd MMMM yyyy, HH:mm'));
      }
      
      if (request.approval_notes) {
        this.currentY += 3;
        this.addFormalSection('Catatan Persetujuan:', request.approval_notes);
      }
      
      if (request.rejection_reason) {
        this.currentY += 3;
        this.addFormalSection('Alasan Penolakan:', request.rejection_reason);
      }
    }
    
    // Signature Section
    this.addSignatureSection(
      request.requester_name,
      request.approved_by_name
    );
    
    // Footer
    this.addFooter();
    
    return this.doc.output('datauristring');
  }

  download(filename: string): void {
    this.doc.save(filename);
  }
}
