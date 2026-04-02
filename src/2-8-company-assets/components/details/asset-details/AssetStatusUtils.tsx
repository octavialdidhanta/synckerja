
export const getStatusBadgeColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'in-use':
      return 'bg-success-muted text-success-foreground';
    case 'available':
      return 'bg-info-muted text-info-foreground';
    case 'maintenance':
      return 'bg-warning-muted text-warning-foreground';
    case 'lost':
      return 'bg-destructive/10 text-destructive';
    case 'retired':
      return 'bg-neutral-muted text-neutral-status';
    case 'other':
    case 'lainnya':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-neutral-muted text-neutral-status';
  }
};

export const getConditionBadgeColor = (condition: string) => {
  switch (condition?.toLowerCase()) {
    case 'excellent':
      return 'bg-success-muted text-success-foreground';
    case 'good':
      return 'bg-info-muted text-info-foreground';
    case 'fair':
      return 'bg-accent text-accent-foreground';
    case 'poor':
      return 'bg-warning-muted text-warning-foreground';
    case 'damaged':
      return 'bg-destructive/10 text-destructive';
    case 'other':
    case 'lainnya':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-neutral-muted text-neutral-status';
  }
};

export const formatAssetStatus = (status: string) => {
  return status === 'other' ? 'Lainnya' : 
         status?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};

export const formatAssetCondition = (condition: string) => {
  return condition === 'other' ? 'Lainnya' : 
         condition?.replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};

export const formatAssetType = (type: string) => {
  return type === 'other' ? 'Lainnya' : type?.replace('-', ' ');
};
