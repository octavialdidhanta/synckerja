
interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  asset_tag: string;
  brand: string;
  model: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: number;
  notes: string;
  image_url: string;
  created_at: string;
  purchase_request_id?: string | null;
  receipt_confirmed_at?: string | null;
  requester_name?: string | null;
  department_name?: string | null;
}

interface UseAssetFiltersProps {
  assets: Asset[];
  searchTerm: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedCondition: string;
  selectedReceiptFilter?: string;
}

export const useAssetFilters = ({ 
  assets, 
  searchTerm, 
  selectedCategory, 
  selectedStatus, 
  selectedCondition,
  selectedReceiptFilter = 'all',
}: UseAssetFiltersProps) => {
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchTerm === '' || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset as Asset).requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset as Asset).department_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All Types' || 
      asset.type?.toLowerCase() === selectedCategory.toLowerCase() ||
      (selectedCategory === 'Lainnya' && asset.type?.toLowerCase() === 'other');

    const matchesStatus = selectedStatus === 'All Statuses' || 
      asset.status?.toLowerCase() === selectedStatus.toLowerCase().replace(' ', '-') ||
      (selectedStatus === 'Lainnya' && asset.status?.toLowerCase() === 'other');

    const matchesCondition = selectedCondition === 'All Conditions' || 
      asset.condition?.toLowerCase() === selectedCondition.toLowerCase() ||
      (selectedCondition === 'Lainnya' && asset.condition?.toLowerCase() === 'other');

    const fromPurchaseRequest = !!asset.purchase_request_id;
    const receiptConfirmed = !!asset.receipt_confirmed_at;
    const matchesReceipt =
      selectedReceiptFilter === 'all' ||
      (selectedReceiptFilter === 'pending' && fromPurchaseRequest && !receiptConfirmed) ||
      (selectedReceiptFilter === 'received' && fromPurchaseRequest && receiptConfirmed);

    return matchesSearch && matchesCategory && matchesStatus && matchesCondition && matchesReceipt;
  });

  return { filteredAssets };
};
