import {
  EnvironmentLibrary,
  Panel,
  PosterQrThumb,
  PreviewSharePanel,
  ToggleRow,
} from "@/components/features/editor/EditorUi";
import { getRangeStyle } from "@/components/features/editor/utils";
import AppImage from "@/components/shared/AppImage";
import StudioColorPicker from "@/components/features/editor/StudioColorPicker";
import {
  Boxes,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import type { EditorPanelsProps } from "./types";
import MaterialsInspectorPanel from "./MaterialsInspectorPanel";

export default function EditorSidebarPanels({
  activeTab,
  primaryActionClass,
  product,
  publicOrigin,
  generatePoster,
  environmentImage,
  setEnvironmentImage,
  useSkybox,
  setUseSkybox,
  exposure,
  setExposure,
  environmentSaturation,
  setEnvironmentSaturation,
  backgroundColor,
  setBackgroundColor,
  shadowIntensity,
  setShadowIntensity,
  shadowSoftness,
  setShadowSoftness,
  showToast,
  isValidHDR,
  logoName,
  setLogoName,
  logoImage,
  handleLogoFile,
  setIsPickingLogoDecal,
  setIsPickingHotspot,
  isPickingLogoDecal,
  logoSize,
  setLogoSize,
  logoRotation,
  setLogoRotation,
  logoOpacity,
  setLogoOpacity,
  addLogoDecal,
  logoDecals,
  deleteLogoDecal,
  selectedMaterialIndex,
  handleMaterialSlotChange,
  materials,
  materialInspectorSetting,
  nativeMaterialSetting,
  onMaterialInspectorChange,
  autoRotate,
  setAutoRotate,
  cameraControls,
  setCameraControls,
  showArButton,
  setShowArButton,
  interactionPrompt,
  setInteractionPrompt,
  realScale,
  setRealScale,
  arModelUnit,
  setArModelUnit,
  autoPlay,
  setAutoPlay,
  hideControls,
  setHideControls,
  ctaEnabled,
  setCtaEnabled,
  ctaType,
  setCtaType,
  ctaLabel,
  setCtaLabel,
  ctaUrl,
  setCtaUrl,
  initialZoom,
  setInitialZoom,
  fov,
  setFov,
  isPickingHotspot,
  hotspotPosition,
  setHotspotPosition,
  hotspotTitle,
  setHotspotTitle,
  hotspotDescription,
  setHotspotDescription,
  addHotspot,
  hotspots,
  deleteHotspot,
  openAddVariantModal,
  openDuplicateVariantModal,
  variants,
  loadVariant,
  activeVariantId,
  openRenameVariantModal,
  deleteVariant,
}: EditorPanelsProps) {
  return (
    <>
      {activeTab === "camera" && (
        <>
          <Panel title="Product info" open>
            <div className="grid gap-2">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E4E7E9] bg-white px-3 py-2.5">
                <p className="shrink-0 text-[12px] font-medium text-[#737373]">Name</p>
                <h3 className="min-w-0 truncate text-right text-[13px] font-semibold text-[#111111]">
                  {product?.title || "No product"}
                </h3>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E4E7E9] bg-white px-3 py-2.5">
                <p className="shrink-0 text-[12px] font-medium text-[#737373]">Category</p>
                <h3 className="min-w-0 truncate text-right text-[13px] font-semibold text-[#111111]">
                  {product?.category || "Uncategorized"}
                </h3>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E4E7E9] bg-white px-3 py-2.5">
                <p className="shrink-0 text-[12px] font-medium text-[#737373]">File</p>
                <h3
                  className="min-w-0 truncate text-right text-[13px] font-semibold text-[#111111]"
                  title={product?.fileName || "No GLB loaded"}
                >
                  {product?.fileName || "No GLB loaded"}
                </h3>
              </div>
            </div>
          </Panel>

          <Panel title="Initial camera position and poster" open>
            <button
              type="button"
              onClick={generatePoster}
              className={`editor-primary-action h-11 rounded-xl px-5 text-[13px] font-semibold ${primaryActionClass}`}
            >
              Generate poster
            </button>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
              First choose if the product stands on the floor or hangs on a wall, then poster is created.
            </p>

            {product?.poster ? (
              <>
                <PosterQrThumb
                  posterUrl={product.poster}
                  qrDestination={`${publicOrigin}/viewer/${product.publicId || product.id}?source=qr&landing=1`}
                />

                <Panel title="Preview & Share" open>
                  <PreviewSharePanel
                    publicId={String(product.publicId || product.id || "")}
                    publicOrigin={publicOrigin}
                    posterUrl={product.poster}
                    productSlug={String(product.publicId || product.id || product.title || "product")}
                    onCustomizePoster={() => void generatePoster()}
                    onToast={showToast}
                  />
                </Panel>
              </>
            ) : (
              <div className="mt-4 grid h-[190px] place-items-center overflow-hidden rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA]">
                <div className="px-4 text-center">
                  <ImageIcon className="mx-auto text-[#D1D5DB]" size={48} />
                  <p className="mt-3 text-[13px] font-semibold text-[#6B7280]">
                    Generate poster to unlock preview, QR and share links
                  </p>
                </div>
              </div>
            )}
          </Panel>
        </>
      )}

      {activeTab === "lighting" && (
        <Panel title="Lighting" open>
          <EnvironmentLibrary
            value={environmentImage}
            onChange={(value) => {
              setEnvironmentImage(value);
              setUseSkybox(false);
              showToast(`Environment changed to ${value}`);
            }}
            onHdrUpload={async (file) => {
              const valid = await isValidHDR(file);

              if (!valid) {
                showToast("Invalid HDR. Upload Radiance .hdr only.");
                return;
              }

              const productUid = product?.id || product?.productUid;
              const customerUid = product?.customerUid;
              if (!productUid) {
                showToast("Save product first, then upload HDR.");
                return;
              }

              try {
                const formData = new FormData();
                formData.append("hdr", file);
                formData.append("productUid", String(productUid));
                if (customerUid) formData.append("customerUid", String(customerUid));

                const res = await fetch("/api/products/hdr-upload", {
                  method: "POST",
                  body: formData,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(data.error || "HDR upload failed");
                }

                const nextUrl = String(data.environmentImage || "");
                if (!nextUrl) throw new Error("HDR upload returned no URL");

                setEnvironmentImage(nextUrl);
                setUseSkybox(true);
                setExposure(0.9);
                setShadowIntensity(1.25);
                setShadowSoftness(0.7);
                showToast("HDR applied successfully");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "HDR upload failed");
              }
            }}
            onRemoveHdr={() => {
              setEnvironmentImage("/hdr/neutral.hdr");
              setUseSkybox(false);
              showToast("HDR removed");
            }}
          />

          <label className="editor-panel-divider mt-5 block border-t pt-5 text-xs font-bold text-slate-400">
            Exposure
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={exposure}
              onChange={(e) => setExposure(Number(e.target.value))}
              className="editor-range flex-1"
              style={getRangeStyle(exposure, 0, 4)}
            />
            <div className="editor-value-pill h-9 w-14 rounded-lg grid place-items-center text-sm font-bold">
              {exposure.toFixed(1)}
            </div>
          </div>

          <label className="mt-5 block text-xs font-bold text-slate-400" title="Only HDR lighting color. Product Base Color stays.">
            HDR Saturation
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={environmentSaturation}
              onInput={(e) => setEnvironmentSaturation(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => setEnvironmentSaturation(Number(e.target.value))}
              className="editor-range flex-1"
              style={getRangeStyle(environmentSaturation, 0, 2)}
            />
            <div className="editor-value-pill h-9 w-14 rounded-lg grid place-items-center text-sm font-bold">
              {environmentSaturation.toFixed(2)}
            </div>
          </div>

          <div className="editor-panel-divider mt-6 border-t pt-5">
            <h4 className="font-black text-sm">Background</h4>

            <label className="flex items-center gap-3 text-sm text-[#374151] mt-4">
              <input
                type="checkbox"
                checked={useSkybox}
                disabled={!environmentImage || environmentImage === "default"}
                onChange={(e) => setUseSkybox(e.target.checked)}
                className="editor-checkbox disabled:opacity-40"
              />
              Use Environment as Skybox
            </label>

            <div className="flex items-center gap-3 mt-5">
              <span className="text-xs text-slate-400 font-bold">
                Color
              </span>

              <StudioColorPicker
                value={backgroundColor}
                onChange={setBackgroundColor}
                onReset={() => setBackgroundColor("#F0F2F5")}
                size="md"
                title="Background color"
              />
            </div>
          </div>

          <div className="editor-panel-divider mt-6 border-t pt-5">
            <h4 className="font-black text-sm">Shadows</h4>

            <label className="text-xs text-slate-400 font-bold block mt-5">
              Shadow Intensity
            </label>

            <div className="flex items-center gap-3 mt-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={shadowIntensity}
                onChange={(e) => setShadowIntensity(Number(e.target.value))}
                className="editor-range flex-1"
                style={getRangeStyle(shadowIntensity, 0, 2)}
              />
              <div className="editor-value-pill h-9 w-14 rounded-lg grid place-items-center text-sm font-bold">
                {shadowIntensity}
              </div>
            </div>

            <label className="text-xs text-slate-400 font-bold block mt-5">
              Shadow Softness
            </label>

            <div className="flex items-center gap-3 mt-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={shadowSoftness}
                onChange={(e) => setShadowSoftness(Number(e.target.value))}
                className="editor-range flex-1"
                style={getRangeStyle(shadowSoftness, 0, 2)}
              />
              <div className="editor-value-pill h-9 w-14 rounded-lg grid place-items-center text-sm font-bold">
                {shadowSoftness}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === "logo" && (
        <>
          <Panel title="Logo Decal Editor" open>
            <p className="text-xs font-bold leading-relaxed text-slate-400">
              Original SS/material same rahega. Logo product surface ke upar sticker/decal layer ki tarah place hoga.
            </p>

            <label className="mt-5 block text-xs font-bold text-slate-400">
              Logo name
            </label>
            <input
              value={logoName}
              onChange={(e) => setLogoName(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl bg-white border border-[#ECECEC] text-[#111111] px-4 text-sm font-bold text-white outline-none"
              placeholder="Brand logo"
            />

            <label className="mt-5 block text-xs font-bold text-slate-400">
              Upload PNG / SVG logo
            </label>
            <label className="mt-2 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.03] text-sm font-black text-slate-200 transition hover:bg-white/[.06]">
              <Upload size={20} />
              Choose logo file
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
              />
            </label>

            {logoImage && (
              <div className="mt-4 rounded-2xl border border-[#ECECEC] bg-white/[.04] p-4">
                <AppImage
                  src={logoImage}
                  alt="Logo preview"
                  className="mx-auto max-h-24 object-contain"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsPickingLogoDecal(true);
                setIsPickingHotspot(false);
                showToast("Canvas par logo ki position click karo.");
              }}
              className="mt-5 h-11 w-full rounded-xl bg-white/10 text-sm font-black text-white transition hover:bg-white/15"
            >
              {isPickingLogoDecal ? "Click on product surface..." : "Pick position on model"}
            </button>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400">Size</label>
                <input
                  type="range"
                  min="24"
                  max="180"
                  value={logoSize}
                  onChange={(e) => setLogoSize(Number(e.target.value))}
                  className="editor-range mt-3 w-full"
                  style={getRangeStyle(logoSize, 24, 180)}
                />
                <p className="mt-1 text-xs font-black text-slate-300">{logoSize}px</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400">Rotation</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={logoRotation}
                  onChange={(e) => setLogoRotation(Number(e.target.value))}
                  className="editor-range mt-3 w-full"
                  style={getRangeStyle(logoRotation, -180, 180)}
                />
                <p className="mt-1 text-xs font-black text-slate-300">{logoRotation}°</p>
              </div>
            </div>

            <label className="mt-5 block text-xs font-bold text-slate-400">Opacity</label>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.05"
              value={logoOpacity}
              onChange={(e) => setLogoOpacity(Number(e.target.value))}
              className="editor-range mt-3 w-full"
              style={getRangeStyle(logoOpacity, 0.15, 1)}
            />

            <button
              type="button"
              onClick={addLogoDecal}
              className={`editor-primary-action mt-5 h-11 w-full rounded-xl text-sm font-black ${primaryActionClass}`}
            >
              Add Logo To Product
            </button>
          </Panel>

          <Panel title={`Placed logos (${logoDecals.length})`} open>
            {logoDecals.length === 0 ? (
              <p className="text-sm font-bold text-slate-400">Abhi koi logo placed nahi hai.</p>
            ) : (
              <div className="space-y-3">
                {logoDecals.map((decal) => (
                  <div
                    key={decal.id}
                    className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white/[.04] p-3"
                  >
                    <AppImage
                      src={decal.image}
                      alt={decal.name}
                      className="h-10 w-10 rounded-lg bg-white object-contain p-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{decal.name}</p>
                      <p className="text-xs font-bold text-slate-400">{decal.size}px • {Math.round(decal.opacity * 100)}%</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteLogoDecal(decal.id)}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {activeTab === "materials" && (
        <Panel title="Material Inspector" open>
          <MaterialsInspectorPanel
            materials={materials}
            selectedMaterialIndex={selectedMaterialIndex}
            onSelectMaterial={handleMaterialSlotChange}
            setting={materialInspectorSetting}
            nativeSetting={nativeMaterialSetting}
            onChange={onMaterialInspectorChange}
          />
        </Panel>
      )}
      {activeTab === "viewer" && (
        <Panel title="Viewer Settings" open>
          <ToggleRow
            label="Auto Rotate"
            checked={autoRotate}
            onChange={setAutoRotate}
          />

          <ToggleRow
            label="Camera Controls"
            checked={cameraControls}
            onChange={setCameraControls}
          />

          <ToggleRow
            label="AR Button"
            checked={showArButton}
            onChange={setShowArButton}
          />

          <ToggleRow
            label="Interaction Prompt"
            checked={interactionPrompt}
            onChange={setInteractionPrompt}
          />

          <ToggleRow
            label="1:1 Real Scale"
            checked={realScale}
            onChange={setRealScale}
          />

          <div className="space-y-1.5">
            <label className="block text-xs text-slate-400 font-bold">Model units (AR size)</label>
            <select
              className="w-full h-11 bg-white border border-[#ECECEC] text-[#111111] rounded-lg px-4 outline-none text-sm font-bold"
              value={arModelUnit}
              onChange={(e) => setArModelUnit(e.target.value as typeof arModelUnit)}
              title="GLB export units. Wrong unit makes AR look huge or tiny."
            >
              <option value="auto">Auto-detect</option>
              <option value="m">Meters</option>
              <option value="cm">Centimeters</option>
              <option value="mm">Millimeters</option>
            </select>
            <p className="text-[11px] font-semibold leading-snug text-slate-500">
              AR expects meters. If the product looks huge in AR, pick Centimeters or Millimeters.
            </p>
          </div>

          <ToggleRow
            label="Auto Play Animation"
            checked={autoPlay}
            onChange={setAutoPlay}
          />

          <ToggleRow
            label="Hide Viewer Controls"
            checked={hideControls}
            onChange={setHideControls}
          />

          <div className="mt-6 border-t border-white/5 pt-5 space-y-3">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Viewer CTA</p>
            <ToggleRow label="Enable CTA" checked={ctaEnabled} onChange={setCtaEnabled} />
            {ctaEnabled ? (
              <>
                <label className="block text-xs text-slate-400 font-bold">CTA Type</label>
                <select
                  className="w-full h-11 mt-1 bg-white border border-[#ECECEC] text-[#111111] rounded-lg px-4 outline-none text-sm font-bold"
                  value={ctaType}
                  onChange={(e) => setCtaType(e.target.value as typeof ctaType)}
                >
                  <option value="buy_now">Buy Now</option>
                  <option value="visit_website">Visit Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="contact_seller">Contact Seller</option>
                  <option value="request_quote">Request Quote</option>
                  <option value="tel">Phone (tel)</option>
                  <option value="mailto">Email (mailto)</option>
                  <option value="pdf">PDF / Document URL</option>
                  <option value="custom">Custom URL</option>
                </select>
                <label className="block text-xs text-slate-400 font-bold mt-3">Button label (optional)</label>
                <input
                  className="w-full h-11 mt-1 bg-white border border-[#ECECEC] text-[#111111] rounded-lg px-4 outline-none text-sm font-bold"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Custom label"
                />
                <label className="block text-xs text-slate-400 font-bold mt-3">
                  {ctaType === "whatsapp"
                    ? "WhatsApp number"
                    : ctaType === "tel"
                      ? "Phone number"
                      : ctaType === "mailto"
                        ? "Email address"
                        : "Destination URL"}
                </label>
                <input
                  className="w-full h-11 mt-1 bg-white border border-[#ECECEC] text-[#111111] rounded-lg px-4 outline-none text-sm font-bold"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder={
                    ctaType === "whatsapp" || ctaType === "tel"
                      ? "+91XXXXXXXXXX"
                      : ctaType === "mailto"
                        ? "hello@example.com"
                        : "https://"
                  }
                />
                {ctaEnabled && !String(ctaUrl || "").trim() ? (
                  <p className="text-xs font-semibold text-amber-600">
                    CTA stays disabled on the public viewer until a destination is set.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="mt-6 border-t border-white/5 pt-5">
            <label className="text-xs text-slate-400 font-bold">
              Initial Zoom
            </label>

            <div className="flex gap-3 mt-2">
              <input
                type="range"
                min="0"
                max="100"
                value={initialZoom}
                onChange={(e) => setInitialZoom(Number(e.target.value))}
                className="editor-range flex-1"
                style={getRangeStyle(initialZoom, 0, 100)}
              />

              <div className="editor-value-pill w-16 h-10 rounded-xl grid place-items-center font-bold">
                {initialZoom}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500">
              0 = zoom out · 50 = center · 100 = zoom in
            </p>
          </div>

          <div className="mt-6 border-t border-white/5 pt-5">
            <label className="text-xs text-slate-400 font-bold">
              Field Of View
            </label>

            <div className="flex gap-3 mt-2">
              <input
                type="range"
                min="20"
                max="90"
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                className="editor-range flex-1"
                style={getRangeStyle(fov, 20, 90)}
              />

              <div className="editor-value-pill w-16 h-10 rounded-xl grid place-items-center font-bold">
                {fov} deg
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === "hotspots" && (
        <>
          <Panel title="Hotspot Picker" open>
            <p className="text-sm text-slate-400 mb-4">
              Click Pick Position, then click on the 3D model where you
              want to place the hotspot.
            </p>

            <button
              type="button"
              onClick={() => setIsPickingHotspot(true)}
              className={`editor-primary-action h-11 w-full rounded-xl text-sm font-black ${primaryActionClass}`}
            >
              {isPickingHotspot ? "Click on model..." : "Pick Position"}
            </button>

            <div className="mt-4">
              <label className="text-sm text-slate-400">Position</label>
              <input
                value={hotspotPosition}
                onChange={(e) => setHotspotPosition(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl bg-[#FAFAFA] border border-[#ECECEC] text-[#111111] border border-[#ECECEC] px-4 text-sm outline-none"
              />
            </div>
          </Panel>

          <Panel title="Hotspot Content" open>
            <div>
              <label className="text-sm text-slate-400">Title</label>
              <input
                value={hotspotTitle}
                onChange={(e) => setHotspotTitle(e.target.value)}
                placeholder="Feature title"
                className="mt-2 h-11 w-full rounded-xl bg-[#FAFAFA] border border-[#ECECEC] text-[#111111] border border-[#ECECEC] px-4 text-sm outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm text-slate-400">Description</label>
              <textarea
                value={hotspotDescription}
                onChange={(e) => setHotspotDescription(e.target.value)}
                placeholder="Write feature details..."
                className="mt-2 h-28 w-full rounded-xl bg-[#FAFAFA] border border-[#ECECEC] text-[#111111] border border-[#ECECEC] px-4 py-3 text-sm outline-none resize-none"
              />
            </div>

            <button
              type="button"
              onClick={addHotspot}
              className={`editor-primary-action mt-4 h-11 w-full rounded-xl text-sm font-black ${primaryActionClass}`}
            >
              Add Hotspot
            </button>
          </Panel>

          <Panel title={`Hotspots (${hotspots.length})`} open>
            {hotspots.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hotspots added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {hotspots.map((hotspot) => (
                  <div
                    key={hotspot.id}
                    className="rounded-xl bg-[#FAFAFA] border border-[#ECECEC] text-[#111111] border border-[#ECECEC] p-4"
                  >
                    <h4 className="font-black text-sm">{hotspot.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {hotspot.description}
                    </p>
                    <p className="text-[11px] text-[#5FA800] mt-2 break-all">
                      {hotspot.position}
                    </p>

                    <button
                      type="button"
                      onClick={() => deleteHotspot(hotspot.id)}
                      className="mt-3 h-9 px-4 rounded-lg bg-red-500/15 text-red-300 font-black text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {activeTab === "configurations" && (
        <>
          <Panel title="Configurations" open>
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => void openAddVariantModal()}
                className={`flex-1 h-10 rounded-xl text-sm font-black ${primaryActionClass}`}
                title="Save current materials & lighting as a new variant"
              >
                + Add
              </button>

              <button
                onClick={openDuplicateVariantModal}
                className="flex-1 h-10 rounded-xl border border-[#E5E7EB] bg-[#F4F5F5] text-[#111416] font-black text-sm hover:bg-[#ECEEF0]"
              >
                Duplicate
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  onClick={() => loadVariant(variant)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    activeVariantId === variant.id
                      ? "editor-accent-card border-[color:var(--ar-primary-border)]"
                      : "bg-[#FAFBFC] border-[#E8EBE8] hover:bg-[#F4F5F5]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#ECECEC] bg-white grid place-items-center">
                      {variant.poster ? (
                        <AppImage
                          src={variant.poster}
                          className="h-full w-full object-contain bg-white"
                          alt={variant.name}
                        />
                      ) : (
                        <Boxes className="text-[#5FA800]" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-black">{variant.name}</p>
                      <p className="text-xs text-slate-400">
                        {activeVariantId === variant.id
                          ? "Active variant"
                          : "Saved configuration"}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameVariantModal(variant.id);
                      }}
                      className="text-slate-400 hover:text-[#5FA800] text-sm"
                    >
                      Rename
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVariant(variant.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
