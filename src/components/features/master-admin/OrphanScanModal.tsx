"use client";

import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import { fmtFileSize } from "@/components/features/master-admin/storage-utils";

export type OrphanFolder = {
  path: string;
  customerUid: string;
  productUid: string;
  sizeBytes: number;
};

type Props = {
  open: boolean;
  scan: {
    orphanCount: number;
    orphanBytes: number;
    orphans: OrphanFolder[];
    scannedCustomers: number;
  } | null;
  deleting?: boolean;
  onClose: () => void;
  onConfirmDelete: (orphanPaths: string[]) => void;
};

export default function OrphanScanModal({ open, scan, deleting, onClose, onConfirmDelete }: Props) {
  if (!open || !scan) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Orphan Scan Results</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {scan.orphanCount} folders · {fmtFileSize(scan.orphanBytes)} · {scan.scannedCustomers} customers scanned
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {scan.orphans.length === 0 ? (
            <p className="text-center text-[13px] font-semibold text-slate-400">
              No orphan product folders found on disk.
            </p>
          ) : (
            <div className="space-y-2">
              {scan.orphans.map((orphan) => (
                <div key={orphan.path} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[12px] font-bold text-slate-900">
                    {orphan.customerUid} / {orphan.productUid}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{orphan.path}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-600">{fmtFileSize(orphan.sizeBytes)}</p>
                </div>
              ))}
              {scan.orphanCount > scan.orphans.length && (
                <p className="text-[11px] font-semibold text-slate-400">
                  Showing first {scan.orphans.length} of {scan.orphanCount} orphans.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <AdminButton type="button" onClick={onClose}>
            Close
          </AdminButton>
          {scan.orphanCount > 0 && (
            <AdminButton
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => onConfirmDelete(scan.orphans.map((row) => row.path))}
            >
              {deleting ? "Deleting..." : `Delete ${scan.orphanCount} Orphans`}
            </AdminButton>
          )}
        </div>
      </div>
    </div>
  );
}
