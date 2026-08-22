import fs from "fs";

const path = "src/components/shared/ModelViewer.tsx";
let s = fs.readFileSync(path, "utf8");

const old = `  const live: MaterialSetting = {
    baseColor: input.baseColor || "#ffffff",
    metalness: Number(input.metalness ?? 0),
    roughness: Number(input.roughness ?? 0.5),
    emissiveColor: input.emissiveColor || "#000000",
    baseColorTexture: input.baseColorTexture,
    metallicRoughnessTexture: input.metallicRoughnessTexture,
    normalTexture: input.normalTexture,
    emissiveTexture: input.emissiveTexture,
    occlusionTexture: input.occlusionTexture,
  };

  if (shouldApplyMaterialOverride(live)) {
    const idx = Number(input.selectedMaterialIndex ?? 0);
    settings[idx] = {
      ...settings[idx],
      ...live,
      baseColor: live.baseColor,
      metalness: live.metalness,
      roughness: live.roughness,
      emissiveColor: live.emissiveColor,
    };
  }

  return settings;
}`;

const neu = `  // Live factor overlay is for the product editor (selected material slot).
  // Public/embed viewers pass only allMaterialSettings — skip live merge so
  // product-level last-save colors never paint over every variation.
  const hasScopedMaterials = Object.keys(settings).length > 0;
  const hasLiveProps =
    input.baseColor != null ||
    input.metalness != null ||
    input.roughness != null ||
    input.emissiveColor != null ||
    Boolean(input.baseColorTexture) ||
    Boolean(input.metallicRoughnessTexture) ||
    Boolean(input.normalTexture) ||
    Boolean(input.emissiveTexture) ||
    Boolean(input.occlusionTexture);

  if (hasLiveProps && (!hasScopedMaterials || input.selectedMaterialIndex != null)) {
    const live: MaterialSetting = {
      baseColor: input.baseColor || "#ffffff",
      metalness: Number(input.metalness ?? 0),
      roughness: Number(input.roughness ?? 0.5),
      emissiveColor: input.emissiveColor || "#000000",
      baseColorTexture: input.baseColorTexture,
      metallicRoughnessTexture: input.metallicRoughnessTexture,
      normalTexture: input.normalTexture,
      emissiveTexture: input.emissiveTexture,
      occlusionTexture: input.occlusionTexture,
    };

    if (shouldApplyMaterialOverride(live)) {
      const idx = Number(input.selectedMaterialIndex ?? 0);
      settings[idx] = {
        ...settings[idx],
        ...live,
        baseColor: live.baseColor,
        metalness: live.metalness,
        roughness: live.roughness,
        emissiveColor: live.emissiveColor,
      };
    }
  }

  return settings;
}`;

if (!s.includes(old)) {
  console.error("OLD BLOCK NOT FOUND");
  process.exit(1);
}

fs.writeFileSync(path, s.replace(old, neu));
console.log("patched", path);
