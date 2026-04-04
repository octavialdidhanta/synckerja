/**
 * Calculate payment summary from total amount and payment history
 * @param totalAmount - Total amount of the sales activity
 * @param paymentHistory - Array of payment records
 * @returns Payment summary object with totals and status
 */
export const calculatePaymentSummary = (
  totalAmount: number,
  paymentHistory: any[]
): {
  totalAmount: number;
  totalPaid: number;
  remainingAmount: number;
  paymentCount: number;
  isFullyPaid: boolean;
  progressPercentage: number;
} => {
  const totalPaid = paymentHistory.reduce((sum, payment) => {
    return sum + (parseFloat(payment.payment_amount) || 0);
  }, 0);

  const remainingAmount = totalAmount - totalPaid;
  const paymentCount = paymentHistory.length;
  const isFullyPaid = remainingAmount <= 0;
  const paymentPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  return {
    totalAmount,
    totalPaid,
    remainingAmount: Math.max(0, remainingAmount), // Ensure non-negative
    paymentCount,
    isFullyPaid,
    progressPercentage: Math.min(100, Math.max(0, paymentPercentage)), // Clamp between 0-100
  };
};

/**
 * Calculate progressive remaining amounts for each payment
 * @param totalAmount - Total amount of the sales activity
 * @param paymentHistory - Array of payment records (should be sorted by date/sequence)
 * @returns Array of progressive payment objects with all original fields plus calculated fields
 */
export const calculateProgressiveRemaining = (
  totalAmount: number,
  paymentHistory: any[]
): any[] => {
  // Sort payments by date or sequence if available
  const sortedPayments = [...paymentHistory].sort((a, b) => {
    if (a.payment_sequence && b.payment_sequence) {
      return a.payment_sequence - b.payment_sequence;
    }
    const dateA = new Date(a.payment_date).getTime();
    const dateB = new Date(b.payment_date).getTime();
    return dateA - dateB;
  });

  let cumulativePaid = 0;

  return sortedPayments.map((payment) => {
    const paymentAmount = parseFloat(payment.payment_amount) || 0;
    cumulativePaid += paymentAmount;
    const remainingAmount = Math.max(0, totalAmount - cumulativePaid);
    const progressPercentage = totalAmount > 0 ? (cumulativePaid / totalAmount) * 100 : 0;

    // Return all original payment fields plus calculated fields
    return {
      ...payment, // Preserve all original fields (id, payment_date, payment_type, payment_amount, payment_method, notes, receipt_url, etc.)
      remainingAfterPayment: remainingAmount, // Calculated remaining amount after this payment
      cumulativePaid, // Total paid up to this payment
      progressPercentage, // Progress percentage up to this payment
    };
  });
};

/**
 * Generate invoice number based on payment type and sequence
 * @param paymentType - Type of payment (down_payment, final_payment, partial_payment)
 * @param paymentSequence - Sequence number of the payment
 * @param clientName - Name of the client
 * @returns Formatted invoice number
 */
export const generateInvoiceNumber = (
  paymentType: string,
  paymentSequence: number,
  clientName?: string
): string => {
  const prefix = paymentType === 'down_payment' ? 'DP' : 
                 paymentType === 'final_payment' ? 'FP' : 
                 'INV';
  const clientInitials = clientName 
    ? clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3)
    : 'CLT';
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const sequence = String(paymentSequence).padStart(3, '0');
  
  return `${prefix}-${clientInitials}-${year}${month}-${sequence}`;
};

/**
 * Generate smart invoice title based on payment type and sequence
 * @param paymentType - Type of payment
 * @param paymentSequence - Sequence number of the payment
 * @returns Invoice title string
 */
export const generateSmartInvoiceTitle = (
  paymentType: string,
  paymentSequence: number
): string => {
  const typeLabel = paymentType === 'down_payment' ? 'Down Payment' :
                    paymentType === 'final_payment' ? 'Final Payment' :
                    'Invoice';
  
  if (paymentSequence > 1) {
    return `${typeLabel} #${paymentSequence}`;
  }
  
  return typeLabel;
};

