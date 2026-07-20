"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import ClientProductHubActions from "./ClientProductHubActions";

export type ClientDeliveryProduct = {
  product_uid: string;
  name: string;
  status?: string | null;
};

export type ClientDeliveryQr = {
  id?: number;
  qr_uid: string;
  name: string;
  scans_count?: number;
  created_at?: string;
  product_id?: string;
  product_title?: string;
};

export default function ClientDeliveryHub({
  products,
  qrCodes,
  emptyHint,
}: {
  products: ClientDeliveryProduct[];
  qrCodes: ClientDeliveryQr[];
  emptyHint?: string;
}) {
  const qrByProduct = new Map<string, ClientDeliveryQr>();
  for (const qr of qrCodes) {
    const pid = String(qr.product_id || "").trim();
    if (pid && !qrByProduct.has(pid)) qrByProduct.set(pid, qr);
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#ECECEC] bg-[#FAFAFA] px-6 py-14 text-center">
        <Package size={32} className="mb-3 text-[#C8CDD4]" />
        <p className="text-sm font-semibold text-[#111111]">No client products yet</p>
        <p className="mt-2 max-w-md text-xs font-medium text-[#737373]">
          {emptyHint ||
            "Assign a product on the Products tab — QR, Share, Embed, AR, branding and domains are managed from here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => {
        const qr = qrByProduct.get(product.product_uid);
        return (
          <article
            key={product.product_uid}
            className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F0F0F0] pb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#737373]">
                  Client deliverable
                </p>
                <h4 className="mt-0.5 truncate text-base font-extrabold text-[#111111]">
                  {product.name}
                </h4>
                <p className="mt-1 text-[11px] font-medium text-[#737373]">
                  Status:{" "}
                  <span className="font-bold text-[#5FA800]">{product.status || "ready"}</span>
                  {qr ? (
                    <>
                      {" "}
                      · QR{" "}
                      <Link
                        href={`/dashboard/qr-center?productId=${encodeURIComponent(product.product_uid)}`}
                        className="font-bold text-[#111111] underline-offset-2 hover:underline"
                      >
                        {qr.name} ({qr.qr_uid})
                      </Link>
                      {" "}
                      · {qr.scans_count ?? 0} scans
                    </>
                  ) : (
                    <> · QR will appear when the product is published</>
                  )}
                </p>
              </div>
            </div>
            <p className="mb-3 mt-4 text-xs font-medium text-[#737373]">
              Manage everything for this end-customer from one place — same tools as your main
              dashboard, scoped to this product.
            </p>
            <ClientProductHubActions
              productId={product.product_uid}
              productTitle={product.name}
              qrRecordId={qr?.id}
            />
          </article>
        );
      })}
    </div>
  );
}
