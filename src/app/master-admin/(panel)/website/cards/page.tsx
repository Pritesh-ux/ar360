"use client";

import { useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { LayoutGrid, Plus, Save, Trash2 } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";

type WebsiteCard = {
  card_uid: string;
  section_uid: string;
  title: string;
  description: string;
  button_label: string | null;
  button_link: string | null;
  sort_order: number;
  visibility: boolean | number;
};

const SECTIONS = [
  { uid: "ws_features", label: "Features" },
  { uid: "ws_howitworks", label: "How it works" },
  { uid: "ws_faq", label: "FAQ" },
  { uid: "ws_trusted", label: "Trusted strip" },
  { uid: "ws_analytics", label: "Analytics stats" },
] as const;

const ICON_OPTIONS = [
  "Code",
  "QrCode",
  "Apple",
  "Smartphone",
  "Box",
  "Upload",
  "Layers",
  "Sun",
  "Palette",
  "Globe",
  "BarChart3",
  "ShoppingCart",
  "Sparkles",
  "Rocket",
  "Share2",
  "LineChart",
  "TrendingUp",
  "Sliders",
  "HelpCircle",
];

const emptyDraft = (sectionUid: string): WebsiteCard => ({
  card_uid: "",
  section_uid: sectionUid,
  title: "",
  description: "",
  button_label: "Sparkles",
  button_link: "",
  sort_order: 0,
  visibility: true,
});

export default function WebsiteCardsPage() {
  const [sectionUid, setSectionUid] = useState<string>("ws_features");
  const [cards, setCards] = useState<WebsiteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<WebsiteCard | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);

  const sectionLabel = SECTIONS.find((s) => s.uid === sectionUid)?.label || sectionUid;

  const fetchCards = () => {
    setLoading(true);
    fetch(`/api/master-admin/website/builder/cards?section_uid=${encodeURIComponent(sectionUid)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.cards)) {
          setCards(
            data.cards.map((card: WebsiteCard) => ({
              ...card,
              visibility: Boolean(card.visibility),
            })),
          );
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useDeferredEffect(() => {
    fetchCards();
  }, [sectionUid]);

  const sorted = useMemo(
    () => [...cards].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    [cards],
  );

  const saveCard = async () => {
    if (!editor) return;
    if (!editor.title.trim()) {
      alert("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/builder/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_uid: editor.card_uid || undefined,
          section_uid: editor.section_uid,
          title: editor.title.trim(),
          description: editor.description.trim(),
          button_label: editor.button_label || null,
          button_link: editor.button_link || null,
          sort_order: Number(editor.sort_order) || 0,
          visibility: Boolean(editor.visibility),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Save failed.");
        return;
      }
      setEditor(null);
      fetchCards();
    } catch {
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (cardUid: string) => {
    setDeleteUid(null);
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/builder/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", card_uid: cardUid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Delete failed.");
        return;
      }
      fetchCards();
    } catch {
      alert("Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Landing content cards"
        subtitle="Edit Features, FAQ, How it works, and other homepage card grids stored in Website CMS."
        backHref="/master-admin/website"
        backLabel="Back to CMS"
        actions={
          <button
            type="button"
            className="dash-premium-btn-primary h-10 px-4 text-[12px]"
            onClick={() =>
              setEditor(
                emptyDraft(sectionUid),
              )
            }
          >
            <Plus size={15} />
            Add card
          </button>
        }
      />

      <div className="dash-premium-card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-[220px]">
          <UserFilterDropdown
            hideLabel
            compact
            className="w-full"
            menuWidth={220}
            label="Section"
            menuTitle="Section"
            value={sectionUid}
            options={SECTIONS.map((s) => s.uid)}
            onChange={setSectionUid}
            renderOption={(value) => SECTIONS.find((s) => s.uid === value)?.label || value}
            renderValue={(value) => SECTIONS.find((s) => s.uid === value)?.label || value}
          />
        </div>
        <p className="text-[12px] font-semibold text-[#667085]">
          {sorted.length} card{sorted.length === 1 ? "" : "s"} in <span className="text-[#111827]">{sectionLabel}</span>
          {sectionUid === "ws_features" ? " · shown on landing Features grid" : ""}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="dash-premium-card h-36 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="dash-premium-card p-12 text-center">
          <LayoutGrid className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
          <h3 className="text-sm font-bold text-[#111827]">No cards in this section</h3>
          <p className="mt-1 text-xs font-medium text-[#667085]">Add the first card with the button above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((card) => (
            <div key={card.card_uid} className="dash-premium-card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    #{card.sort_order} · {card.button_label || "No icon"}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-[#0F1412]">{card.title}</h3>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                    card.visibility ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {card.visibility ? "Visible" : "Hidden"}
                </span>
              </div>
              <p className="mt-2 flex-1 text-[12px] font-medium leading-relaxed text-[#667085]">
                {card.description || "—"}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="dash-premium-btn-secondary h-8 px-3 text-[10px]"
                  onClick={() => setEditor({ ...card })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                  onClick={() => setDeleteUid(card.card_uid)}
                  title="Delete card"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editor ? (
        <ViewportPortal>
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-4"
            role="presentation"
            onClick={() => setEditor(null)}
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-lg font-black text-[#0F1412]">
                {editor.card_uid ? "Edit card" : "Add card"} · {sectionLabel}
              </h2>
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Title</span>
                  <input
                    className="h-10 w-full rounded-[14px] border border-[#ECECEC] px-3 text-[13px] font-semibold"
                    value={editor.title}
                    onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Description</span>
                  <textarea
                    className="min-h-24 w-full rounded-[14px] border border-[#ECECEC] p-3 text-[13px] font-medium"
                    value={editor.description}
                    onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Icon (Lucide)</span>
                    <select
                      className="h-10 w-full rounded-[14px] border border-[#ECECEC] px-3 text-[13px] font-semibold"
                      value={editor.button_label || "Sparkles"}
                      onChange={(event) => setEditor({ ...editor, button_label: event.target.value })}
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Sort order</span>
                    <input
                      type="number"
                      className="h-10 w-full rounded-[14px] border border-[#ECECEC] px-3 text-[13px] font-semibold"
                      value={editor.sort_order}
                      onChange={(event) =>
                        setEditor({ ...editor, sort_order: Number(event.target.value) || 0 })
                      }
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[12px] font-bold text-[#374151]">
                  <input
                    type="checkbox"
                    checked={Boolean(editor.visibility)}
                    onChange={(event) => setEditor({ ...editor, visibility: event.target.checked })}
                  />
                  Visible on website
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="dash-premium-btn-secondary h-10 px-4 text-[12px]"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="dash-premium-btn-primary h-10 px-4 text-[12px]"
                  onClick={() => void saveCard()}
                >
                  <Save size={14} />
                  {saving ? "Saving…" : "Save card"}
                </button>
              </div>
            </div>
          </div>
        </ViewportPortal>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteUid)}
        title="Delete card?"
        description="This removes the card from Website CMS and the public landing section."
        confirmText="Delete"
        danger
        onConfirm={() => {
          if (deleteUid) void deleteCard(deleteUid);
        }}
        onCancel={() => setDeleteUid(null)}
      />
    </div>
  );
}
