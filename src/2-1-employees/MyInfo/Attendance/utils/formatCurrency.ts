
export const formatToRupiah = (amount: string | number | null | undefined): string => {
  if (!amount || amount === '' || amount === 'Not specified' || amount === 'null' || amount === 'undefined') {
    return 'Not specified';
  }

  let numericAmount: number;
  
  if (typeof amount === 'string') {
    // Remove any non-digit characters except decimal points
    const cleanedAmount = amount.replace(/[^\d.]/g, '');
    numericAmount = parseFloat(cleanedAmount);
  } else {
    numericAmount = amount;
  }
  
  // More robust NaN and zero checking
  if (isNaN(numericAmount) || numericAmount === 0 || numericAmount < 0) {
    return 'Not specified';
  }

  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  } catch (error) {
    console.error('Error formatting currency:', error, 'Amount:', amount);
    return 'Not specified';
  }
};
