import type { LogoDesign } from "@/lib/branding/logo-design";

export type ClientCatalogProduct = {
  id: string;
  title: string;
  poster: string;
  thumbnailUrl: string;
  variantCount: number;
  variants: Array<{ id: string; name: string; poster: string }>;
};

export type ClientCatalogResult = {
  enabled: boolean;
  /** Public /c/{uid} link past plan/link expire date. */
  linkExpired?: boolean;
  clientUid: string;
  clientName: string;
  logoUrl?: string;
  brandPrimary?: string;
  logoDesign?: LogoDesign;
  products: ClientCatalogProduct[];
};
