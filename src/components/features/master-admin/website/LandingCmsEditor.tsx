"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Eye,
  History,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { useMasterAdminToast } from "@/components/features/master-admin/MasterAdminToastContext";
import WebsiteAssetPicker from "@/components/features/master-admin/website/WebsiteAssetPicker";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  LANDING_NAVIGATOR_SECTIONS,
  resolveCmsTarget,
  type InspectorField,
} from "@/lib/website/landing-editor.targets";
import type {
  LandingDraftMeta,
  LandingEditorDocument,
  LandingStyleSettings,
} from "@/lib/website/landing-editor.types";
import { LANDING_ALIGN, LANDING_FONT_SIZE, LANDING_SPACING } from "@/lib/website/landing-editor.types";

type Viewport = "desktop" | "tablet" | "mobile";
type MobilePane = "preview" | "inspector";

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "834px",
  mobile: "390px",
};

function cloneDoc(doc: LandingEditorDocument): LandingEditorDocument {
  return JSON.parse(JSON.stringify(doc));
}

function emptyDoc(): LandingEditorDocument {
  return {
    version: 1,
    settings: {},
    navigation: [],
    sections: [],
    cards: [],
    categories: [],
    showcases: [],
  };
}

export default function LandingCmsEditor() {
  const { showToast } = useMasterAdminToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [document, setDocument] = useState<LandingEditorDocument>(emptyDoc);
  const [meta, setMeta] = useState<LandingDraftMeta | null>(null);
  const [versions, setVersions] = useState<{ version_uid: string; created_at: string }[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>("section:hero");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetFieldKey, setAssetFieldKey] = useState<string | null>(null);
  const [history, setHistory] = useState<LandingEditorDocument[]>([]);
  const [future, setFuture] = useState<LandingEditorDocument[]>([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const resolved = useMemo(
    () => resolveCmsTarget(selectedTarget, document),
    [selectedTarget, document],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-admin/website/editor?versions=1", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load editor");
      setDocument(data.document);
      setMeta(data.meta);
      setVersions(data.versions || []);
      setDirty(Boolean(data.meta?.dirty));
      setHistory([]);
      setFuture([]);
    } catch (err: any) {
      showToast(err.message || "Failed to load editor", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ar360-cms-select") {
        setSelectedTarget(event.data.target || null);
        setMobilePane("inspector");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function pushHistory(next: LandingEditorDocument) {
    setHistory((prev) => [...prev.slice(-39), cloneDoc(document)]);
    setFuture([]);
    setDocument(next);
    setDirty(true);
  }

  function undo() {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setFuture((f) => [cloneDoc(document), ...f]);
      setDocument(last);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }

  function redo() {
    setFuture((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      setHistory((h) => [...h, cloneDoc(document)]);
      setDocument(first);
      setDirty(true);
      return rest;
    });
  }

  function updateByTarget(mutator: (doc: LandingEditorDocument) => void) {
    const next = cloneDoc(document);
    mutator(next);
    pushHistory(next);
  }

  function patchResolvedField(key: string, value: unknown) {
    if (!resolved) return;
    updateByTarget((doc) => {
      if (resolved.target === "popup" || resolved.target === "footer" || resolved.target === "social") {
        doc.settings[key] = String(value ?? "");
        return;
      }
      if (resolved.target.startsWith("section:")) {
        const section = doc.sections.find(
          (s) => s.section_key === resolved.target.split(":")[1] || s.section_uid === resolved.target.split(":")[1],
        );
        if (!section) return;
        if (key === "style_settings") {
          section.style_settings = value as LandingStyleSettings;
        } else if (key === "buttons") {
          section.buttons = value as any;
        } else if (key === "visibility") {
          section.visibility = Boolean(value);
        } else {
          (section as any)[key] = value;
        }
        return;
      }
      if (resolved.target.startsWith("card:")) {
        const card = doc.cards.find((c) => c.card_uid === resolved.target.split(":")[1]);
        if (!card) return;
        if (key === "style_settings") card.style_settings = value as LandingStyleSettings;
        else if (key === "visibility") card.visibility = Boolean(value);
        else (card as any)[key] = value;
        return;
      }
      if (resolved.target.startsWith("nav:")) {
        const nav = doc.navigation.find((n) => n.nav_uid === resolved.target.split(":")[1]);
        if (!nav) return;
        if (key === "visibility") nav.visibility = Boolean(value);
        else (nav as any)[key] = value;
        return;
      }
      if (resolved.target.startsWith("showcase:")) {
        const id = resolved.target.split(":")[1];
        const showcase = doc.showcases.find((s) => s.showcase_uid === id || s.slug === id);
        if (!showcase) return;
        if (key === "style_settings") showcase.style_settings = value as LandingStyleSettings;
        else if (key === "visibility") showcase.visibility = Boolean(value);
        else if (key === "benefits") showcase.benefits = value as string[];
        else (showcase as any)[key] = value;
        return;
      }
      if (resolved.target.startsWith("category:")) {
        const id = resolved.target.split(":")[1];
        const category = doc.categories.find((c) => c.category_uid === id || c.slug === id);
        if (!category) return;
        if (key === "visibility") category.visibility = Boolean(value);
        else (category as any)[key] = value;
      }
    });
  }

  function readFieldValue(field: InspectorField): any {
    if (!resolved) return "";
    if (field.kind === "style" || field.kind === "order" || field.kind === "info") return null;
    if (resolved.target === "popup" || resolved.target === "footer" || resolved.target === "social") {
      const raw = document.settings[field.key] ?? "";
      if (field.kind === "toggle") return raw === "1" || raw === "true";
      return raw;
    }
    if (resolved.target.startsWith("section:")) {
      const section = document.sections.find(
        (s) => s.section_key === resolved.target.split(":")[1] || s.section_uid === resolved.target.split(":")[1],
      );
      return section ? (section as any)[field.key] : "";
    }
    if (resolved.target.startsWith("card:")) {
      const card = document.cards.find((c) => c.card_uid === resolved.target.split(":")[1]);
      return card ? (card as any)[field.key] : "";
    }
    if (resolved.target.startsWith("nav:")) {
      const nav = document.navigation.find((n) => n.nav_uid === resolved.target.split(":")[1]);
      return nav ? (nav as any)[field.key] : "";
    }
    if (resolved.target.startsWith("showcase:")) {
      const id = resolved.target.split(":")[1];
      const showcase = document.showcases.find((s) => s.showcase_uid === id || s.slug === id);
      return showcase ? (showcase as any)[field.key] : "";
    }
    if (resolved.target.startsWith("category:")) {
      const id = resolved.target.split(":")[1];
      const category = document.categories.find((c) => c.category_uid === id || c.slug === id);
      return category ? (category as any)[field.key] : "";
    }
    return "";
  }

  function readStyle(): LandingStyleSettings {
    if (!resolved) return {};
    if (resolved.target.startsWith("section:")) {
      const section = document.sections.find(
        (s) => s.section_key === resolved.target.split(":")[1] || s.section_uid === resolved.target.split(":")[1],
      );
      return section?.style_settings || {};
    }
    if (resolved.target.startsWith("card:")) {
      const card = document.cards.find((c) => c.card_uid === resolved.target.split(":")[1]);
      return card?.style_settings || {};
    }
    if (resolved.target.startsWith("showcase:")) {
      const id = resolved.target.split(":")[1];
      const showcase = document.showcases.find((s) => s.showcase_uid === id || s.slug === id);
      return showcase?.style_settings || {};
    }
    return {};
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          document,
          expectedRevision: meta?.revision ?? 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDocument(data.document);
      setMeta((m) => (m ? { ...m, revision: data.revision, status: "draft", dirty: true } : m));
      setDirty(true);
      setPreviewKey((k) => k + 1);
      showToast("Draft saved", "ok");
    } catch (err: any) {
      showToast(err.message || "Save failed", "err");
      if (String(err.message || "").includes("revision conflict")) void load();
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch("/api/master-admin/website/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          document,
          expectedRevision: meta?.revision ?? 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setDocument(data.document);
      setMeta((m) =>
        m
          ? {
              ...m,
              revision: data.revision,
              status: "published",
              dirty: false,
              published_at: new Date().toISOString(),
            }
          : m,
      );
      setDirty(false);
      setConfirmPublish(false);
      setPreviewKey((k) => k + 1);
      showToast("Published to live site", "ok");
      void load();
    } catch (err: any) {
      showToast(err.message || "Publish failed", "err");
      if (String(err.message || "").includes("revision conflict")) void load();
    } finally {
      setPublishing(false);
    }
  }

  async function restore(versionUid: string) {
    setPublishing(true);
    try {
      const res = await fetch("/api/master-admin/website/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", versionUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setConfirmRestore(null);
      showToast("Version restored", "ok");
      await load();
      setPreviewKey((k) => k + 1);
    } catch (err: any) {
      showToast(err.message || "Restore failed", "err");
    } finally {
      setPublishing(false);
    }
  }

  function moveShowcase(uid: string, dir: -1 | 1) {
    updateByTarget((doc) => {
      const sorted = [...doc.showcases].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((s) => s.showcase_uid === uid);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swap];
      const tmp = a.sort_order;
      a.sort_order = b.sort_order;
      b.sort_order = tmp;
    });
  }

  function softDeleteShowcase(uid: string) {
    if (!window.confirm("Hide/delete this use case from the landing page?")) return;
    updateByTarget((doc) => {
      const row = doc.showcases.find((s) => s.showcase_uid === uid);
      if (!row) return;
      row.deleted_at = new Date().toISOString();
      row.visibility = false;
    });
  }

  function duplicateShowcase(uid: string) {
    updateByTarget((doc) => {
      const row = doc.showcases.find((s) => s.showcase_uid === uid);
      if (!row) return;
      const copy = cloneDoc({ version: 1, settings: {}, navigation: [], sections: [], cards: [], categories: [], showcases: [row] }).showcases[0];
      copy.showcase_uid = `sh_${Math.random().toString(16).slice(2, 14)}`;
      copy.name = `${row.name} copy`;
      copy.slug = `${row.slug}-copy-${Date.now().toString(36)}`;
      copy.sort_order = doc.showcases.length;
      copy.deleted_at = null;
      copy.visibility = true;
      doc.showcases.push(copy);
    });
  }

  const previewSrc = `/?cms_preview=1&v=${previewKey}`;

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-4">
      <AdminPageHeader
        title="Visual Landing Editor"
        subtitle="Click the live preview to edit content, images, links, visibility, and style presets. Layout stays protected."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewport(id)}
              className={`rounded-lg p-2 ${viewport === id ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
              aria-label={id}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button type="button" onClick={undo} disabled={!history.length} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Undo">
          <Undo2 size={15} />
        </button>
        <button type="button" onClick={redo} disabled={!future.length} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Redo">
          <Redo2 size={15} />
        </button>

        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${dirty ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {dirty ? "Unsaved changes" : meta?.status === "draft" ? "Draft saved" : "In sync with live"}
          {meta ? ` · rev ${meta.revision}` : ""}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                if (dirty) await saveDraft();
                else setPreviewKey((k) => k + 1);
              })();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <Eye size={14} />
            Preview draft
          </button>
          <button
            type="button"
            onClick={() => setConfirmPublish(true)}
            disabled={publishing || loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#111] px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            <Upload size={14} />
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={14} />
            Open live site
          </Link>
        </div>
      </div>

      <div className="flex gap-2 xl:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${mobilePane === "preview" ? "bg-[#111] text-white" : "bg-white border border-slate-200"}`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("inspector")}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${mobilePane === "inspector" ? "bg-[#111] text-white" : "bg-white border border-slate-200"}`}
        >
          Inspector
        </button>
      </div>

      <div className="grid min-h-[70vh] flex-1 gap-3 xl:grid-cols-[minmax(180px,220px)_minmax(0,1fr)_minmax(280px,340px)]">
        {/* Navigator */}
        <aside className="hidden min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 xl:block">
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Sections</p>
          {LANDING_NAVIGATOR_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTarget(item.target)}
              className={`mb-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                selectedTarget === item.target || selectedTarget?.includes(item.id)
                  ? "bg-[#F3FCE3] text-[#3F7400]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-3 border-t border-slate-100 px-2 pt-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Also</p>
            <Link href="/master-admin/website/assets" className="mb-1 block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Assets library
            </Link>
            <Link href="/master-admin/website/models" className="mb-1 block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              GLB models
            </Link>
            <Link href="/master-admin/website/policy" className="mb-1 block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Policies
            </Link>
            <Link href="/master-admin/website/settings" className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Global settings
            </Link>
          </div>
        </aside>

        {/* Preview */}
        <section
          className={`min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
            mobilePane === "preview" ? "block" : "hidden xl:block"
          }`}
        >
          <div className="flex h-full justify-center overflow-auto p-2 sm:p-3">
            <div
              className="h-full min-h-[60vh] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg transition-all"
              style={{ width: VIEWPORT_WIDTH[viewport], maxWidth: "100%" }}
            >
              {loading ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">Loading editor…</div>
              ) : (
                <iframe
                  ref={iframeRef}
                  key={previewKey}
                  title="Landing preview"
                  src={previewSrc}
                  className="h-full min-h-[60vh] w-full border-0"
                />
              )}
            </div>
          </div>
        </section>

        {/* Inspector */}
        <aside
          className={`min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 ${
            mobilePane === "inspector" ? "block" : "hidden xl:block"
          }`}
        >
          {!resolved ? (
            <p className="text-sm text-slate-500">Click an element in the preview to edit it.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Inspector</p>
                <h3 className="mt-1 text-sm font-black text-slate-900">{resolved.title}</h3>
              </div>

              {resolved.fields.map((field, idx) => {
                if (field.kind === "info") {
                  return (
                    <p key={idx} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {field.text}
                    </p>
                  );
                }
                if (field.kind === "style") {
                  const style = readStyle();
                  return (
                    <div key={idx} className="space-y-2 rounded-xl border border-slate-100 p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Style presets</p>
                      <label className="block text-xs font-semibold text-slate-600">
                        Spacing
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          value={style.spacing || "normal"}
                          onChange={(e) =>
                            patchResolvedField("style_settings", { ...style, spacing: e.target.value })
                          }
                        >
                          {LANDING_SPACING.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Alignment
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          value={style.align || "left"}
                          onChange={(e) =>
                            patchResolvedField("style_settings", { ...style, align: e.target.value })
                          }
                        >
                          {LANDING_ALIGN.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Font size
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          value={style.fontSize || "md"}
                          onChange={(e) =>
                            patchResolvedField("style_settings", { ...style, fontSize: e.target.value })
                          }
                        >
                          {LANDING_FONT_SIZE.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Text color
                        <input
                          type="color"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200"
                          value={style.textColor || "#111111"}
                          onChange={(e) =>
                            patchResolvedField("style_settings", { ...style, textColor: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs font-bold text-[#5AA700]"
                        onClick={() => patchResolvedField("style_settings", {})}
                      >
                        Reset to theme
                      </button>
                    </div>
                  );
                }
                if (field.kind === "toggle") {
                  const value = Boolean(readFieldValue(field));
                  return (
                    <label key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs font-semibold">
                      {field.label}
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => patchResolvedField(field.key, e.target.checked)}
                      />
                    </label>
                  );
                }
                if (field.kind === "media") {
                  const value = String(readFieldValue(field) || "");
                  return (
                    <div key={idx} className="space-y-2 rounded-xl border border-slate-100 p-3">
                      <p className="text-xs font-semibold text-slate-600">{field.label}</p>
                      {value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value} alt="" className="h-28 w-full rounded-lg object-cover" />
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-[#111] px-3 py-1.5 text-xs font-bold text-white"
                          onClick={() => {
                            setAssetFieldKey(field.key);
                            setAssetOpen(true);
                          }}
                        >
                          Choose image
                        </button>
                        {value ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold"
                            onClick={() => patchResolvedField(field.key, "")}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                if (field.kind === "benefits") {
                  const value = (readFieldValue(field) as string[]) || [];
                  return (
                    <label key={idx} className="block text-xs font-semibold text-slate-600">
                      {field.label}
                      <textarea
                        className="mt-1 min-h-[110px] w-full rounded-lg border border-slate-200 px-2 py-1.5"
                        value={value.join("\n")}
                        onChange={(e) =>
                          patchResolvedField(
                            field.key,
                            e.target.value
                              .split("\n")
                              .map((l) => l.trim())
                              .filter(Boolean)
                              .slice(0, 12),
                          )
                        }
                      />
                      <span className="mt-1 block text-[10px] font-medium text-slate-400">One benefit per line</span>
                    </label>
                  );
                }
                if (field.kind === "buttons") {
                  const buttons = (readFieldValue(field) as { label: string; href: string; style?: string }[]) || [];
                  return (
                    <div key={idx} className="space-y-2 rounded-xl border border-slate-100 p-3">
                      <p className="text-xs font-semibold text-slate-600">{field.label}</p>
                      {buttons.map((btn, bi) => (
                        <div key={bi} className="grid gap-1 rounded-lg bg-slate-50 p-2">
                          <input
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                            value={btn.label}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[bi] = { ...next[bi], label: e.target.value };
                              patchResolvedField(field.key, next);
                            }}
                          />
                          <input
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                            value={btn.href}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[bi] = { ...next[bi], href: e.target.value };
                              patchResolvedField(field.key, next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }
                if (field.kind === "order" && resolved.target.startsWith("showcase:")) {
                  const uid = document.showcases.find(
                    (s) => s.showcase_uid === resolved.target.split(":")[1] || s.slug === resolved.target.split(":")[1],
                  )?.showcase_uid;
                  if (!uid) return null;
                  return (
                    <div key={idx} className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-lg border px-2 py-1 text-xs font-bold" onClick={() => moveShowcase(uid, -1)}>
                        Move left
                      </button>
                      <button type="button" className="rounded-lg border px-2 py-1 text-xs font-bold" onClick={() => moveShowcase(uid, 1)}>
                        Move right
                      </button>
                      <button type="button" className="rounded-lg border px-2 py-1 text-xs font-bold" onClick={() => duplicateShowcase(uid)}>
                        Duplicate
                      </button>
                      <button type="button" className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700" onClick={() => softDeleteShowcase(uid)}>
                        Delete
                      </button>
                    </div>
                  );
                }
                if (field.kind === "order") return null;

                const value = String(readFieldValue(field) ?? "");
                const multiline = field.kind === "text" ? Boolean(field.multiline) : false;
                const maxLength = field.kind === "text" ? field.maxLength : undefined;
                return (
                  <label key={idx} className="block text-xs font-semibold text-slate-600">
                    {field.label}
                    {multiline ? (
                      <textarea
                        className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-200 px-2 py-1.5"
                        value={value}
                        maxLength={maxLength}
                        onChange={(e) => patchResolvedField(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                        value={value}
                        maxLength={maxLength}
                        onChange={(e) => patchResolvedField(field.key, e.target.value)}
                      />
                    )}
                  </label>
                );
              })}

              {selectedTarget === "section:usecases" || selectedTarget?.startsWith("showcase:") ? (
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Use cases</p>
                  <div className="space-y-1">
                    {[...document.showcases]
                      .filter((s) => !s.deleted_at)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((s) => (
                        <button
                          key={s.showcase_uid}
                          type="button"
                          onClick={() => setSelectedTarget(`showcase:${s.showcase_uid}`)}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${
                            selectedTarget === `showcase:${s.showcase_uid}`
                              ? "bg-[#F3FCE3] text-[#3F7400]"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.visibility ? "on" : "hidden"}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <History size={12} /> Versions
            </p>
            <div className="space-y-1">
              {versions.length === 0 ? (
                <p className="text-xs text-slate-400">No snapshots yet. Publish to create one.</p>
              ) : (
                versions.slice(0, 8).map((v) => (
                  <button
                    key={v.version_uid}
                    type="button"
                    onClick={() => setConfirmRestore(v.version_uid)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
                  >
                    <span className="font-mono text-slate-600">{v.version_uid.slice(0, 14)}…</span>
                    <span className="text-slate-400">{String(v.created_at).slice(0, 16)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <WebsiteAssetPicker
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        onSelect={(path) => {
          if (assetFieldKey) patchResolvedField(assetFieldKey, path);
          setAssetOpen(false);
          setAssetFieldKey(null);
        }}
      />

      {confirmPublish ? (
        <div className="fixed inset-0 z-[130000] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Publish landing page?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This replaces the live homepage with your current draft and creates a restore snapshot.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setConfirmPublish(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#111] px-3 py-2 text-xs font-bold text-white"
                onClick={() => void publish()}
                disabled={publishing}
              >
                {publishing ? "Publishing…" : "Publish now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRestore ? (
        <div className="fixed inset-0 z-[130000] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Restore this version?</h3>
            <p className="mt-2 text-sm text-slate-600">
              The selected snapshot will be loaded as a draft and published immediately.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setConfirmRestore(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#111] px-3 py-2 text-xs font-bold text-white"
                onClick={() => void restore(confirmRestore)}
                disabled={publishing}
              >
                Restore & publish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
