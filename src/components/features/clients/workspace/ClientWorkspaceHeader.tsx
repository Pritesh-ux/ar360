"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import ViewerBrandMark from "@/components/features/viewer/ViewerBrandMark";
import type { ClientWorkspaceClient } from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";
import { parseLogoDesign, type LogoDesign } from "@/lib/branding/logo-design";

export default function ClientWorkspaceHeader({
  client,
  logoDesign,
  onEditClient,
}: {
  client: ClientWorkspaceClient;
  logoDesign?: LogoDesign;
  onEditClient: () => void;
}) {
  const title = client.company_name || client.name;
  const meta = [client.email, client.phone].filter(Boolean);

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#ECECEC] bg-white px-3 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:gap-4 sm:px-4">
      <Link
        href="/dashboard/clients"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#ECECEC] bg-[#FAFAFA] text-[#111111] hover:bg-white"
        aria-label="Back to clients"
      >
        <ArrowLeft size={16} />
      </Link>

      <div className="grid h-14 w-14 shrink-0 place-items-center">
        {client.logo_url ? (
          <ViewerBrandMark
            src={client.logo_url}
            size={44}
            design={logoDesign || parseLogoDesign(client.branding_json)}
          />
        ) : (
          <span
            className="grid h-full w-full place-items-center text-sm font-black text-[#102000]"
            style={{ backgroundColor: `${client.brand_primary || CLIENT_ACCENT}55` }}
          >
            {(title || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-lg font-bold tracking-tight text-[#111111]">{client.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              client.status === "active"
                ? "bg-[#EEF9E0] text-[#5FA800]"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {client.status || "active"}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-[#737373]">
          {client.company_name && client.company_name !== client.name ? (
            <span className="truncate">{client.company_name}</span>
          ) : null}
          {client.email ? (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail size={11} /> {client.email}
            </span>
          ) : null}
          {client.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone size={11} /> {client.phone}
            </span>
          ) : null}
          {!meta.length && !client.company_name ? (
            <span>Client workspace</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onEditClient}
        className="inline-flex h-9 items-center rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-semibold text-[#111111] hover:bg-[#FAFAFA]"
      >
        Edit client
      </button>
    </header>
  );
}
