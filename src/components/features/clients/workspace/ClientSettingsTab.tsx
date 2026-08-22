"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ClientWorkspaceClient } from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";
import { isClientLinkActive, toYmd } from "@/lib/user-panel/client-plan";

export default function ClientSettingsTab({
  client,
  saving,
  onSave,
  onDelete,
}: {
  client: ClientWorkspaceClient;
  saving?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [companyName, setCompanyName] = useState(client.company_name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [planStartsAt, setPlanStartsAt] = useState(toYmd(client.plan_starts_at) || "");
  const [planExpiresAt, setPlanExpiresAt] = useState(toYmd(client.plan_expires_at) || "");
  const [linkExpiresAt, setLinkExpiresAt] = useState(toYmd(client.link_expires_at) || "");
  const linkActive = isClientLinkActive({
    ...client,
    plan_starts_at: planStartsAt || null,
    plan_expires_at: planExpiresAt || null,
    link_expires_at: linkExpiresAt || null,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave({
      name: name.trim(),
      companyName: companyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      planStartsAt: planStartsAt || null,
      planExpiresAt: planExpiresAt || null,
      linkExpiresAt: linkExpiresAt || null,
    });
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mx-auto max-w-2xl space-y-5 rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h3 className="text-[15px] font-extrabold text-[#111111]">Client settings</h3>
        <p className="mt-1 text-xs font-medium text-[#737373]">
          Profile information only. Branding lives on the Branding tab.
        </p>
      </div>

      <Field label="Client name">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Company name">
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-[#ECECEC] bg-white px-4 py-3 text-sm outline-none focus:border-[#84D400]"
        />
      </Field>

      <div className="rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-4">
        <h4 className="text-[13px] font-extrabold text-[#111111]">Plan &amp; public link</h4>
        <p className="mt-1 text-xs font-medium text-[#737373]">
          Set this client’s plan window. The showroom / QR link turns expired after the link date
          (or the plan expire date if link date is empty).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Plan start">
            <input
              type="date"
              value={planStartsAt}
              onChange={(e) => setPlanStartsAt(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Plan expire">
            <input
              type="date"
              value={planExpiresAt}
              onChange={(e) => setPlanExpiresAt(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Link expire (optional)">
            <input
              type="date"
              value={linkExpiresAt}
              onChange={(e) => setLinkExpiresAt(e.target.value)}
              className={INPUT}
            />
          </Field>
          <p className="mt-2 text-xs font-semibold text-[#737373]">
            Link status:{" "}
            <span className={linkActive ? "text-[#5FA800]" : "text-[#C53030]"}>
              {linkActive ? "Active link" : "Link expired"}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] pt-5">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-[#102000] disabled:opacity-60"
          style={{ backgroundColor: CLIENT_ACCENT }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 size={15} /> Delete client
        </button>
      </div>
    </form>
  );
}

const INPUT =
  "h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
        {label}
      </label>
      {children}
    </div>
  );
}
