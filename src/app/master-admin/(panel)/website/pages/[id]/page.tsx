"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Clock,
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Play,
  RotateCcw,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

type Version = {
  version_uid: string;
  created_at: string;
};

export default function PageEditor({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [editorHtml, setEditorHtml] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNew) return;

    fetch(`/api/master-admin/website/pages/${params.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.page) {
          setTitle(data.page.title);
          setSlug(data.page.slug);
          setStatus(data.page.status);
          setEditorHtml(data.page.content);
          if (editorRef.current) {
            editorRef.current.innerHTML = data.page.content;
          }
        }
        if (data.versions) setVersions(data.versions);
      })
      .catch((err) => console.error("Failed to load page data", err))
      .finally(() => setLoading(false));
  }, [params.id, isNew]);

  // Sync editor content editable value to React state
  const handleEditorInput = () => {
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  // Rich editor toolbar actions using execCommand
  const executeCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) executeCommand("createLink", url);
  };

  const insertImage = () => {
    const url = prompt("Enter Image URL:");
    if (url) executeCommand("insertImage", url);
  };

  const savePage = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_uid: isNew ? undefined : params.id,
          slug,
          title,
          content: editorHtml,
          status,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(isNew ? "Page created successfully!" : "Page saved successfully!");
        if (isNew && data.page_uid) {
          router.replace(`/master-admin/website/pages/${data.page_uid}`);
        } else {
          // reload versions
          const vRes = await fetch(`/api/master-admin/website/pages/${params.id}`, { cache: "no-store" });
          const vData = await vRes.json();
          if (vData.versions) setVersions(vData.versions);
        }
      } else {
        alert(data.error || "Save failed.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = async (versionUid: string) => {
    if (!confirm("Are you sure you want to restore this version? Your current unsaved changes will be saved to history first.")) return;

    try {
      const res = await fetch(`/api/master-admin/website/pages/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_uid: versionUid }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Version restored successfully!");
        window.location.reload();
      } else {
        alert(data.error || "Restore failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <div className="dash-premium-card p-8 text-center text-[13px] font-semibold text-[#667085] animate-pulse">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title={isNew ? "Create Page" : `Edit: ${title}`}
        backHref="/master-admin/website/policy"
        backLabel="Back to Policies & Pages"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <Play size={14} />
              {previewMode ? "Edit Mode" : "Preview Content"}
            </button>
            <button
              type="button"
              onClick={savePage}
              disabled={saving}
              className="dash-premium-btn-primary h-10 px-4 text-[12px] disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving..." : "Save Page"}
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_1fr]">
        {/* Left: Document Editor Area */}
        <div className="dash-premium-card space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-500">
              Page Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Terms of Service"
                className="h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-800 transition"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Slug path
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                placeholder="e.g. terms-of-service"
                className="h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-800 transition"
              />
            </label>
          </div>

          <UserFilterDropdown
            compact
            className="w-full sm:w-48"
            menuWidth={180}
            label="Publish Status"
            menuTitle="Status"
            value={status}
            options={["draft", "published"]}
            onChange={(value) => setStatus(value as typeof status)}
            renderOption={(value) => (value === "published" ? "Published" : "Draft")}
            renderValue={(value) => (value === "published" ? "Published" : "Draft")}
          />

          {/* Notion-style Toolbar */}
          {!previewMode ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-2 border-b border-slate-200 select-none">
                <button type="button" onClick={() => executeCommand("bold")} className="p-2 rounded hover:bg-slate-200/60" title="Bold"><Bold size={15} /></button>
                <button type="button" onClick={() => executeCommand("italic")} className="p-2 rounded hover:bg-slate-200/60" title="Italic"><Italic size={15} /></button>
                <button type="button" onClick={() => executeCommand("underline")} className="p-2 rounded hover:bg-slate-200/60" title="Underline"><Underline size={15} /></button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                <button type="button" onClick={() => executeCommand("formatBlock", "<h1>")} className="p-2 rounded hover:bg-slate-200/60" title="H1"><Heading1 size={15} /></button>
                <button type="button" onClick={() => executeCommand("formatBlock", "<h2>")} className="p-2 rounded hover:bg-slate-200/60" title="H2"><Heading2 size={15} /></button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                <button type="button" onClick={() => executeCommand("insertUnorderedList")} className="p-2 rounded hover:bg-slate-200/60" title="Bullet List"><List size={15} /></button>
                <button type="button" onClick={() => executeCommand("insertOrderedList")} className="p-2 rounded hover:bg-slate-200/60" title="Numbered List"><ListOrdered size={15} /></button>
                <button type="button" onClick={() => executeCommand("formatBlock", "<blockquote>")} className="p-2 rounded hover:bg-slate-200/60" title="Blockquote"><Quote size={15} /></button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                <button type="button" onClick={insertLink} className="p-2 rounded hover:bg-slate-200/60" title="Insert Link"><LinkIcon size={15} /></button>
                <button type="button" onClick={insertImage} className="p-2 rounded hover:bg-slate-200/60" title="Insert Image"><ImageIcon size={15} /></button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                <button type="button" onClick={() => executeCommand("justifyLeft")} className="p-2 rounded hover:bg-slate-200/60" title="Align Left"><AlignLeft size={15} /></button>
                <button type="button" onClick={() => executeCommand("justifyCenter")} className="p-2 rounded hover:bg-slate-200/60" title="Align Center"><AlignCenter size={15} /></button>
                <button type="button" onClick={() => executeCommand("justifyRight")} className="p-2 rounded hover:bg-slate-200/60" title="Align Right"><AlignRight size={15} /></button>
              </div>

              {/* Editable body */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="p-6 min-h-[350px] outline-none text-slate-800 text-sm leading-relaxed prose max-w-none focus:ring-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                style={{ minHeight: "350px" }}
              />
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl p-6 min-h-[400px] bg-slate-50 overflow-y-auto">
              <h1 className="text-3xl font-black mb-4">{title}</h1>
              <div
                className="prose prose-slate max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: editorHtml }}
              />
            </div>
          )}
        </div>

        {/* Right: Version History snapshot control */}
        <div className="dash-premium-card space-y-5 p-5">
          <div className="flex items-center gap-2 border-b border-[#ECECEC] pb-3 font-bold text-[#0F1412]">
            <Clock size={16} />
            Version History
          </div>

          {isNew ? (
            <p className="text-xs font-semibold text-slate-400">
              Version history snapshots will be saved automatically upon publishing modifications.
            </p>
          ) : versions.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400">
              No modifications recorded yet.
            </p>
          ) : (
            <div className="space-y-3.5 max-h-[400px] overflow-y-auto">
              {versions.map((ver) => (
                <div
                  key={ver.version_uid}
                  className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition"
                >
                  <span className="text-[11px] font-bold text-slate-700">
                    {new Date(ver.created_at).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => void restoreVersion(ver.version_uid)}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-[#5AA700] hover:text-[#458000] self-start"
                  >
                    <RotateCcw size={10} />
                    Restore this version
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
