"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientWorkspaceData, ClientWorkspaceTab } from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";
import {
  mergeLogoDesignIntoBrandingJson,
  parseLogoDesign,
  type LogoDesign,
} from "@/lib/branding/logo-design";
import ClientWorkspaceHeader from "./ClientWorkspaceHeader";
import ClientExperienceQrPanel from "./ClientExperienceQrPanel";
import ClientProductsWorkspace from "./ClientProductsWorkspace";
import ClientBrandingTab from "./ClientBrandingTab";
import ClientSettingsTab from "./ClientSettingsTab";

const TABS: Array<{ key: ClientWorkspaceTab; label: string }> = [
  { key: "products", label: "Products" },
  { key: "branding", label: "Branding" },
  { key: "settings", label: "Settings" },
];

type Props = {
  data: ClientWorkspaceData;
  tab: ClientWorkspaceTab;
  onTabChange: (tab: ClientWorkspaceTab) => void;
  saving?: boolean;
  onAssignProduct: () => void;
  onUnlinkProduct: (productId: string) => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  onRemoveLogo: () => Promise<void>;
  onDeleteClient: () => void;
};

export default function ClientWorkspaceShell({
  data,
  tab,
  onTabChange,
  saving,
  onAssignProduct,
  onUnlinkProduct,
  onSave,
  onUploadLogo,
  onRemoveLogo,
  onDeleteClient,
}: Props) {
  const [logoDesign, setLogoDesign] = useState<LogoDesign>(() =>
    parseLogoDesign(data.client.branding_json),
  );
  const savedDesignRef = useRef(JSON.stringify(parseLogoDesign(data.client.branding_json)));
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const next = parseLogoDesign(data.client.branding_json);
    const serialized = JSON.stringify(next);
    savedDesignRef.current = serialized;
    setLogoDesign(next);
  }, [data.client.client_uid, data.client.logo_url]);

  useEffect(() => {
    const serialized = JSON.stringify(logoDesign);
    if (serialized === savedDesignRef.current) return;
    const timer = window.setTimeout(() => {
      void onSaveRef.current({
        brandingJson: mergeLogoDesignIntoBrandingJson(data.client.branding_json, logoDesign),
        silent: true,
      }).then(() => {
        savedDesignRef.current = serialized;
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [logoDesign, data.client.branding_json]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ClientWorkspaceHeader
        client={data.client}
        logoDesign={logoDesign}
        onEditClient={() => onTabChange("settings")}
      />

      <div className="flex shrink-0 flex-wrap gap-1 rounded-[16px] border border-[#ECECEC] bg-white p-1 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`h-9 rounded-xl px-3.5 text-sm font-semibold transition ${
                active ? "text-[#102000]" : "text-[#737373] hover:bg-[#FAFAFA]"
              }`}
              style={active ? { backgroundColor: CLIENT_ACCENT } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "products" ? (
          <ClientProductsWorkspace
            client={data.client}
            products={data.products}
            qrCodes={data.qrCodes}
            onAssign={onAssignProduct}
            onUnlinkProduct={onUnlinkProduct}
          />
        ) : null}

        {tab === "branding" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <ClientExperienceQrPanel client={data.client} products={data.products} />
            <ClientBrandingTab
              key={`${data.client.logo_url || ""}-${data.client.client_uid}`}
              client={data.client}
              logoDesign={logoDesign}
              onLogoDesignChange={setLogoDesign}
              saving={saving}
              onSave={onSave}
              onUploadLogo={onUploadLogo}
              onRemoveLogo={onRemoveLogo}
            />
          </div>
        ) : null}

        {tab === "settings" ? (
          <ClientSettingsTab
            key={data.client.client_uid}
            client={data.client}
            saving={saving}
            onSave={onSave}
            onDelete={onDeleteClient}
          />
        ) : null}
      </div>
    </div>
  );
}
