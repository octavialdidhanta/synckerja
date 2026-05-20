import type jsPDF from "jspdf";
import { loadPdfKit } from "@/shared/lib/pdf/loadPdfKit";

export interface InvoiceData {
  // Company Info
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyLogo?: string;
  /** Stamp or signature image (left signature area). */
  companySignature?: string;
  
  // Invoice Details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  
  // Client Info
  clientName: string;
  clientPhone: string;
  
  // Items
  items: Array<{
    description: string;
    type: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  
  // Totals
  subtotal: number;
  total: number;
  
  // Payment Info
  paidOn?: string;
  remainingAmount: number;
  
  // Payment Details
  paymentInfo?: {
    currentPaymentType: string;
    currentPaymentAmount: number;
    totalPaid: number;
    paymentSequence: number;
    paymentDate?: string;
  };
  
  // Previous Payments (untuk menampilkan semua pembayaran sebelumnya)
  previousPayments?: Array<{
    paymentDate: string;
    amount: number;
    paymentType: string;
    sequence: number;
  }>;
  
  // Additional Notes
  notes?: string;
}

export class InvoiceGenerator {
  private doc: jsPDF;
  private itemsCount: number = 0;
  private readonly autoTableFn: NonNullable<Awaited<ReturnType<typeof loadPdfKit>>["autoTable"]>;

  private constructor(
    doc: jsPDF,
    autoTableFn: NonNullable<Awaited<ReturnType<typeof loadPdfKit>>["autoTable"]>,
  ) {
    this.doc = doc;
    this.autoTableFn = autoTableFn;
  }

  /** Loads jspdf + autotable on demand (vendor-pdf chunk). */
  static async create(): Promise<InvoiceGenerator> {
    const { jsPDF: JsPDF, autoTable } = await loadPdfKit({ withAutoTable: true });
    if (!autoTable) {
      throw new Error("jspdf-autotable failed to load");
    }
    const doc = new JsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [148, 210],
    });
    return new InvoiceGenerator(doc, autoTable);
  }

  generateInvoice(data: InvoiceData): jsPDF {
    console.log('🎯 InvoiceGenerator.generateInvoice called with data:', {
      paymentInfo: data.paymentInfo,
      remainingAmount: data.remainingAmount,
      total: data.total,
      previousPayments: data.previousPayments
    });
    
    // Store items count for styling
    this.itemsCount = data.items.length;
    
    this.addHeader(data);
    this.addClientInfo(data);
    this.addInvoiceDetails(data);
    this.addItemsTable(data);
    this.addSignatureSection(data);
    this.addNotes(data);
    this.addFooter();
    
    return this.doc;
  }

  private logoImageFormat(dataUri: string): 'PNG' | 'JPEG' {
    if (dataUri.includes('image/jpeg') || dataUri.includes('image/jpg')) return 'JPEG';
    return 'PNG';
  }

  private safeAddImage(
    imageData: string,
    format: 'PNG' | 'JPEG',
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    try {
      this.doc.addImage(imageData, format, x, y, w, h);
      return true;
    } catch (err) {
      if (format !== 'JPEG') {
        try {
          this.doc.addImage(imageData, 'JPEG', x, y, w, h);
          return true;
        } catch {
          /* fall through */
        }
      }
      console.warn('Invoice PDF: skipped image embed', err);
      return false;
    }
  }

  /** Fit image inside max box (mm) without stretching — object-fit: contain. */
  private fitImageSizeMm(
    imageData: string,
    maxW: number,
    maxH: number,
  ): { width: number; height: number } {
    try {
      const props = this.doc.getImageProperties(imageData);
      const pxW = props.width;
      const pxH = props.height;
      if (!pxW || !pxH) return { width: maxW, height: maxH };

      const ratio = pxW / pxH;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      return { width: w, height: h };
    } catch {
      const side = Math.min(maxW, maxH);
      return { width: side, height: side };
    }
  }

  private addHeader(data: InvoiceData) {
    const logoMaxW = 28;
    const logoMaxH = 10;
    const logoX = 10;
    const logoY = 10;

    // Company Logo (left) — preserve aspect ratio
    if (data.companyLogo) {
      const fmt = this.logoImageFormat(data.companyLogo);
      const { width: w, height: h } = this.fitImageSizeMm(
        data.companyLogo,
        logoMaxW,
        logoMaxH,
      );
      const drawY = logoY + (logoMaxH - h) / 2;
      this.safeAddImage(data.companyLogo, fmt, logoX, drawY, w, h);
    } else {
      // Placeholder logo box
      this.doc.setDrawColor(200, 200, 200);
      this.doc.rect(logoX, logoY, logoMaxW, logoMaxH);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);
      this.doc.text('LOGO', logoX + logoMaxW / 2, logoY + logoMaxH / 2 + 1, { align: 'center' });
    }
    
    // Invoice title and company info (right)
    this.doc.setFontSize(18);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'bold');
    
    // Dynamic invoice title based on payment type
    let invoiceTitle = 'INVOICE';
    if (data.paymentInfo) {
      const paymentTypeMap = {
        'down_payment': 'INVOICE - DOWN PAYMENT',
        'partial_payment': `INVOICE - PAYMENT #${data.paymentInfo.paymentSequence}`,
        'final_payment': 'INVOICE - FINAL PAYMENT'
      };
      invoiceTitle = paymentTypeMap[data.paymentInfo.currentPaymentType as keyof typeof paymentTypeMap] || 'INVOICE';
    }
    
    this.doc.text(invoiceTitle, 138, 15, { align: 'right' });
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(data.companyName, 138, 22, { align: 'right' });
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(data.companyPhone, 138, 27, { align: 'right' });
    this.doc.text(data.companyEmail, 138, 31, { align: 'right' });
    
    // Address with text wrapping
    const addressLines = this.doc.splitTextToSize(data.companyAddress, 60);
    let yPos = 35;
    addressLines.forEach((line: string) => {
      this.doc.text(line, 138, yPos, { align: 'right' });
      yPos += 3;
    });
    
    // Separator line
    this.doc.setDrawColor(128, 90, 213); // Purple color
    this.doc.setLineWidth(0.5);
    this.doc.line(10, 45, 138, 45);
  }

  private addClientInfo(data: InvoiceData) {
    let yPos = 52;
    
    // Left side - Client Info
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Client/ Customer Information:', 10, yPos);
    yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(data.clientName, 10, yPos);
    yPos += 4;
    this.doc.text(data.clientPhone, 10, yPos);
  }

  private addInvoiceDetails(data: InvoiceData) {
    let yPos = 52;
    
    // Right side - Invoice Details
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Invoice #:', 95, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(data.invoiceNumber, 138, yPos, { align: 'right' });
    yPos += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Date:', 95, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(data.invoiceDate, 138, yPos, { align: 'right' });
    yPos += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Due Date:', 95, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(data.dueDate, 138, yPos, { align: 'right' });
    
    // Separator line
    this.doc.setDrawColor(230, 230, 230);
    this.doc.setLineWidth(0.3);
    this.doc.line(10, 72, 138, 72);
  }

  private addItemsTable(data: InvoiceData) {
    // Regular items only (without Type column)
    const itemsData = data.items.map(item => [
      item.description,
      item.quantity.toString(),
      this.formatCurrency(item.price),
      this.formatCurrency(item.amount)
    ]);

    this.autoTableFn(this.doc, {
      startY: 66,
      head: [['Item', 'Quantity', 'Price', 'Amount']],
      body: itemsData,
      theme: 'grid',
      headStyles: {
        fillColor: [128, 90, 213], // Purple header
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 55 }, // Item (wider since no Type column)
        1: { cellWidth: 15, halign: 'center' }, // Quantity
        2: { cellWidth: 30, halign: 'right' }, // Price
        3: { cellWidth: 28, halign: 'right' } // Amount
      },
      margin: { left: 10, right: 10 },
      tableWidth: 128
    });

    // Add financial summary and payment instruction below table
    this.addFinancialSummaryAndPayment(data);
  }

  private getItemsCount(): number {
    // This method will be set during generation
    return this.itemsCount || 0;
  }

  private addFinancialSummaryAndPayment(data: InvoiceData) {
    const finalY = (this.doc as any).lastAutoTable.finalY || 120;
    let yPos = finalY + 8;

    // Left side - Payment Instruction (from notes)
    if (data.notes && data.notes.trim() !== '') {
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Payment Instruction', 10, yPos);
      
      yPos += 5;
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(60, 60, 60);
      
      // Split notes into lines that fit the left column width (about 70mm)
      const noteLines = this.doc.splitTextToSize(data.notes, 70);
      noteLines.forEach((line: string) => {
        this.doc.text(line, 10, yPos);
        yPos += 4;
      });
    }

    // Right side - Financial Summary
    let rightYPos = finalY + 8;
    
    // Subtotal
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Subtotal', 85, rightYPos);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(this.formatCurrency(data.subtotal), 138, rightYPos, { align: 'right' });
    
    rightYPos += 6;
    
    // Total
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Total', 85, rightYPos);
    this.doc.text(this.formatCurrency(data.total), 138, rightYPos, { align: 'right' });
    
    rightYPos += 4;

    // Payment info if exists
    if (data.paymentInfo || (data.previousPayments && data.previousPayments.length > 0)) {
      console.log('📊 Processing payment display - previousPayments:', data.previousPayments?.length || 0, 'currentPayment:', !!data.paymentInfo);
      
      // Add divider line before payment info
      rightYPos += 3;
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.3);
      this.doc.line(85, rightYPos, 138, rightYPos);
      rightYPos += 5;
      
      // Show all previous payments first (sorted by sequence)
      const allPayments: Array<{
        paymentDate: string;
        amount: number;
        paymentType: string;
        sequence: number;
      }> = [];
      
      // Add previous payments
      if (data.previousPayments && data.previousPayments.length > 0) {
        console.log('📜 Adding previous payments:', data.previousPayments);
        allPayments.push(...data.previousPayments);
      }
      
      // Add current payment
      if (data.paymentInfo) {
        const currentPaymentDate = data.paymentInfo.paymentDate || data.paidOn;
        const formattedCurrentDate = currentPaymentDate ? this.formatDate(currentPaymentDate) : new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        
        const currentPayment = {
          paymentDate: formattedCurrentDate,
          amount: data.paymentInfo.currentPaymentAmount,
          paymentType: data.paymentInfo.currentPaymentType,
          sequence: data.paymentInfo.paymentSequence
        };
        
        console.log('💳 Adding current payment:', currentPayment);
        allPayments.push(currentPayment);
      }
      
      // Sort payments by sequence
      allPayments.sort((a, b) => a.sequence - b.sequence);
      console.log('🔢 All payments sorted by sequence:', allPayments);
      
      // Display all payments
      if (allPayments.length > 0) {
        allPayments.forEach((payment) => {
          this.doc.setFont('helvetica', 'normal');
          this.doc.setTextColor(0, 0, 0);
          
          const formattedDate = payment.paymentDate.includes('/') ? payment.paymentDate : this.formatDate(payment.paymentDate);
          
          // Use shorter labels to prevent overlapping
          let paymentLabel: string;
          if (payment.paymentType === 'down_payment') {
            paymentLabel = `DP - ${formattedDate}`;
          } else if (payment.paymentType === 'final_payment') {
            paymentLabel = `Final - ${formattedDate}`;
          } else {
            paymentLabel = `#${payment.sequence} - ${formattedDate}`;
          }
          
          this.doc.text(paymentLabel, 85, rightYPos);
          this.doc.text(this.formatCurrency(payment.amount), 138, rightYPos, { align: 'right' });
          rightYPos += 5; // Tambahkan spacing yang lebih besar
        });
        
        // Add spacing before remaining balance
        rightYPos += 3;
      }
      
      // Remaining balance
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Sisa Pembayaran', 85, rightYPos);
      this.doc.text(this.formatCurrency(data.remainingAmount), 138, rightYPos, { align: 'right' });
    }
  }

  private addSignatureSection(data?: InvoiceData) {
    const finalY = (this.doc as any).lastAutoTable.finalY || 120;
    let yPos = finalY + 50;
    
    // Agreement text
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('By signing this document, the customer agrees to the services and conditions described in this document.', 10, yPos);
    
    yPos += 10;
    
    // Signature section with proper layout
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    
    const companyName = data?.companyName || 'Company Name';
    const clientName = data?.clientName || 'Client Name';
    const nameY = yPos;

    // Left side - Company signature
    this.doc.text(companyName, 10, nameY);

    // Right side - Client signature
    this.doc.text(clientName, 100, nameY);

    let leftLineY = nameY + 15;
    const sigMaxW = 35;
    const sigMaxH = 14;

    if (data?.companySignature) {
      const fmt = this.logoImageFormat(data.companySignature);
      const { width: sigW, height: sigH } = this.fitImageSizeMm(
        data.companySignature,
        sigMaxW,
        sigMaxH,
      );
      const sigY = nameY + 4;
      this.safeAddImage(data.companySignature, fmt, 10, sigY, sigW, sigH);
      leftLineY = sigY + sigH + 3;
    }

    const rightLineY = nameY + 15;

    // Signature lines
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.3);
    this.doc.line(10, leftLineY, 45, leftLineY);
    this.doc.line(100, rightLineY, 135, rightLineY);

    const dateY = Math.max(leftLineY, rightLineY) + 8;

    // Date under left signature
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);
    const currentDate = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    this.doc.text(currentDate, 10, dateY);
    
    // Date placeholder under right signature
    this.doc.text('(    /    /    )', 100, dateY);
  }

  private addNotes(data: InvoiceData) {
    // Notes are now handled in the Payment Instruction section
    // This method is kept for potential future use but does nothing
    return;
  }

  private addFooter() {
    // Footer at bottom
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(120, 120, 120);
    this.doc.text('Thank you for your business!', 74, 200, { align: 'center' });
    this.doc.text('This invoice was generated electronically.', 74, 204, { align: 'center' });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatDate(dateInput: string): string {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return dateInput;
      
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date format error:', error);
      return dateInput;
    }
  }

  download(filename: string) {
    this.doc.save(filename);
  }

  getDataUri(): string {
    return this.doc.output('datauristring');
  }
}
