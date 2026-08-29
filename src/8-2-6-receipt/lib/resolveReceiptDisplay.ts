export type ReceiptDisplayInput = {
  outletName: string;
  businessName: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  hasOutletLogo: boolean;
  footerNotes: string;
};

export type ReceiptDisplay = {
  title: string;
  addressLine: string;
  phoneLine: string;
  notes: string;
};

export function resolveReceiptDisplay(input: ReceiptDisplayInput): ReceiptDisplay {
  const businessName = input.businessName.trim();
  const outletName = input.outletName.trim();
  const title = input.hasOutletLogo ? outletName || businessName : businessName || outletName;
  const addressParts = input.hasOutletLogo
    ? [businessName, input.city.trim(), input.province.trim(), input.postalCode.trim()]
    : [input.city.trim(), input.province.trim(), input.postalCode.trim()];
  return {
    title,
    addressLine: addressParts.filter(Boolean).join(", "),
    phoneLine: input.phone.trim(),
    notes: input.footerNotes.trim(),
  };
}

export function isSharingIncomplete(input: {
  shareViaEmail: boolean;
  shareViaSms: boolean;
  websiteUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
}): boolean {
  const hasToggle = input.shareViaEmail || input.shareViaSms;
  const hasLink = [
    input.websiteUrl,
    input.twitterUrl,
    input.facebookUrl,
    input.instagramUrl,
    input.tiktokUrl,
    input.whatsappUrl,
  ].some((value) => value.trim().length > 0);
  return !hasToggle && !hasLink;
}
