/**
 * @deprecated Import from @/lib/growth/qr.service.impl for new code.
 * Thin re-export layer for backward compatibility.
 */
export {
  type QrCodeRecord,
  type QrListFilters,
  type QrListResult,
  type QrStatusFilter,
  type QrUpdateInput,
  type QrAnalytics,
  resolveEffectiveQrStatus,
  listCustomerQrCodes,
  updateCustomerQrCode,
  getQrCodeById,
  getQrCodeByPublicId,
  getQrCodeByQrCode,
  trackQrScan,
  getQrAnalytics,
  regenerateQrAsset,
  ensurePermanentProductQr,
  createCustomerQrCode,
} from "@/lib/growth/qr.service.impl";
