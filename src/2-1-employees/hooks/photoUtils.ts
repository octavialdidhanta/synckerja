export const getPhotoUrl = (photoPath: string | null | undefined): string | null => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  if (photoPath.includes('/') && !photoPath.startsWith('employee-photo/')) {
    return `https://najgdwffjhnqlogfrlqa.supabase.co/storage/v1/object/public/employee-profiles/${photoPath}`;
  }
  if (photoPath.startsWith('employee-photo/')) {
    return `https://najgdwffjhnqlogfrlqa.supabase.co/storage/v1/object/public/employee-documents/${photoPath}`;
  }
  return `https://najgdwffjhnqlogfrlqa.supabase.co/storage/v1/object/public/employee-profiles/${photoPath}`;
};

export const getInitials = (name: string): string => {
  if (!name) return "U";
  return name
    .split(" ")
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
