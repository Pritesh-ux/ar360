"use client";

import { useCallback, useState } from "react";
import { ChevronRight } from "lucide-react";
import AppImage from "@/components/shared/AppImage";
import ViewerBrandMark from "@/components/features/viewer/ViewerBrandMark";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import type { ClientCatalogProduct } from "@/lib/user-panel/client-catalog-types";
import { parseLogoDesign, type LogoDesign } from "@/lib/branding/logo-design";

type CatalogResponse = {
  success?: boolean;
  enabled?: boolean;
  logoUrl?: string;
  logoDesign?: LogoDesign | null;
  products?: ClientCatalogProduct[];
};

type Props = {
  clientUid: string;
  activeProductId: string;
  /** Used when client logo_url is empty. */
  fallbackLogoUrl?: string;
  onSelectProduct: (productId: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Notify parent so header/menu can prefer the client logo too. */
  onLogoUrlChange?: (logoUrl: string) => void;
  onLogoDesignChange?: (design: LogoDesign | null) => void;
  /** When true, leave extra bottom room for the variant picker row. */
  hasVariantPicker?: boolean;
};

const TILE = "box-border h-14 w-14 shrink-0 overflow-hidden rounded-2xl";

function ProductThumb({
  product,
  active,
  onClick,
}: {
  product: ClientCatalogProduct;
  active: boolean;
  onClick: () => void;
}) {
  const src = product.thumbnailUrl || product.poster || product.variants[0]?.poster || "";
  return (
    <button
      type="button"
      onClick={onClick}
      title={product.title}
      aria-label={product.title}
      className={`${TILE} grid place-items-center border-2 bg-[#F3F4F6] transition ${
        active ? "border-[#84D400]" : "border-transparent hover:border-[#D4D4D8]"
      }`}
    >
      {src ? (
        <AppImage src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold text-[#C8CDD4]">3D</span>
      )}
    </button>
  );
}

export default function ClientCatalogSidebar({
  clientUid,
  activeProductId,
  fallbackLogoUrl,
  onSelectProduct,
  onOpenChange,
  onLogoUrlChange,
  onLogoDesignChange,
  hasVariantPicker = false,
}: Props) {
  const [products, setProducts] = useState<ClientCatalogProduct[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoDesign, setLogoDesign] = useState<LogoDesign | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!clientUid) {
      setEnabled(false);
      setProducts([]);
      setLogoUrl("");
      setLogoDesign(null);
      onLogoUrlChange?.("");
      onLogoDesignChange?.(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public-client-catalog?client=${encodeURIComponent(clientUid)}`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => ({}))) as CatalogResponse;
      const list = Array.isArray(body.products) ? body.products : [];
      const nextLogo = String(body.logoUrl || "").trim();
      const nextDesign = parseLogoDesign(body.logoDesign);
      setEnabled(Boolean(body.enabled) && list.length > 0);
      setProducts(list);
      setLogoUrl(nextLogo);
      setLogoDesign(nextDesign);
      onLogoUrlChange?.(nextLogo);
      onLogoDesignChange?.(nextDesign);
    } catch {
      setEnabled(false);
      setProducts([]);
      setLogoUrl("");
      setLogoDesign(null);
      onLogoUrlChange?.("");
      onLogoDesignChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [clientUid, onLogoUrlChange, onLogoDesignChange]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useDeferredEffect(() => {
    if (!loading && enabled) onOpenChange?.(open);
    if (!loading && !enabled) onOpenChange?.(false);
  }, [open, loading, enabled, onOpenChange]);

  if (loading || !enabled || products.length === 0) return null;

  const resolvedLogo = logoUrl || String(fallbackLogoUrl || "").trim();

  // White rail goes edge-to-edge; inner padding keeps thumbs above the toolbar.
  const listBottomPad = hasVariantPicker
    ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[9.25rem]"
    : "pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:pb-[5.5rem]";

  return (
    <div
      className="pointer-events-auto fixed inset-y-0 left-0 z-[85] flex items-stretch"
      data-catalog-rail
    >
      <div
        className={`relative flex h-full items-stretch transition-[width] duration-200 ease-out ${
          open ? "w-24" : "w-0"
        }`}
      >
        <aside
          className={`flex h-full w-24 shrink-0 flex-col overflow-hidden border-r border-[#EAEAEA] bg-white ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!open}
        >
          <div className={`flex min-h-0 flex-1 flex-col items-center gap-2.5 overflow-y-auto bg-white px-4 pt-[max(24px,calc(env(safe-area-inset-top)+16px))] ${listBottomPad}`}>
            {resolvedLogo ? (
              <>
                <ViewerBrandMark src={resolvedLogo} size={56} className="shrink-0" design={logoDesign} />
                <div className="h-px w-10 shrink-0 bg-[#EFEFEF]" aria-hidden />
              </>
            ) : null}
            {products.map((product) => (
              <ProductThumb
                key={product.id}
                product={product}
                active={product.id === activeProductId}
                onClick={() => {
                  if (product.id !== activeProductId) onSelectProduct(product.id);
                }}
              />
            ))}
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            onOpenChange?.(next);
            return next;
          });
        }}
        className="my-auto -ml-px flex h-11 w-6 shrink-0 items-center justify-center rounded-r-full border border-l-0 border-[#EAEAEA] bg-white text-[#111111] shadow-[2px_0_10px_rgba(15,23,42,0.08)] transition active:scale-[0.98]"
        aria-label={open ? "Hide product list" : "Show product list"}
        aria-expanded={open}
      >
        <ChevronRight
          size={16}
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
