/** True when production has something to review: a Drive link, or carousel images for Post/Carousel. */
export function hasProductionDeliverable(input: {
  googleDriveLink?: string | null;
  contentTypeName?: string | null;
  carouselImageCount?: number;
}): boolean {
  const typeName = input.contentTypeName ?? '';
  if (typeName === 'Post' || typeName === 'Carousel') {
    return (input.carouselImageCount ?? 0) > 0;
  }
  return Boolean(input.googleDriveLink && input.googleDriveLink.trim().length > 0);
}

/** Dropdown value for Production Status. Need Review requires a deliverable. */
export function productionStatusSelectValue(input: {
  productionApproved?: boolean | null;
  productionStatus?: string | null;
  googleDriveLink?: string | null;
  contentTypeName?: string | null;
  carouselImageCount?: number;
}): string {
  if (input.productionApproved) return 'Approved';
  const status = (input.productionStatus ?? '').trim();
  const hasDeliverable = hasProductionDeliverable(input);
  if (!hasDeliverable && (status === '' || status.toLowerCase() === 'need review')) {
    return 'none';
  }
  if (!status) return hasDeliverable ? 'Need Review' : 'none';
  return status;
}
