import assert from "node:assert/strict";
import test from "node:test";
import {
  bakeKhrTransmissionIntoGlb,
  materialSettingsNeedKhrTransmissionBake,
} from "@/lib/materials/khr-transmission-bake";

async function makeOpaqueGlb(): Promise<Uint8Array> {
  const { Document, NodeIO } = await import("@gltf-transform/core");
  const doc = new Document();
  doc.createMaterial("Gem").setMetallicFactor(1).setRoughnessFactor(0).setAlphaMode("OPAQUE");
  doc.createMaterial("Gold").setMetallicFactor(1).setRoughnessFactor(0.2);
  const io = new NodeIO();
  return io.writeBinary(doc);
}

test("materialSettingsNeedKhrTransmissionBake detects transmission slots", () => {
  assert.equal(materialSettingsNeedKhrTransmissionBake({}), false);
  assert.equal(
    materialSettingsNeedKhrTransmissionBake({ 0: { transmission: 0.9 } }),
    true,
  );
  assert.equal(
    materialSettingsNeedKhrTransmissionBake({ 0: { ior: 2.42 } }),
    true,
  );
});

test("bakeKhrTransmissionIntoGlb writes KHR_materials_transmission + volume + ior", async () => {
  const input = await makeOpaqueGlb();
  const result = await bakeKhrTransmissionIntoGlb(input, {
    0: {
      type: "gemstone",
      transmission: 0.88,
      ior: 2.42,
      thickness: 0.35,
      attenuationDistance: 0.85,
      attenuationColor: "#eaf3ff",
      metalness: 0,
      alphaMode: "OPAQUE",
    },
    1: {
      transmission: 0,
      metalness: 1,
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.materialsTouched, 1);
  assert.ok(result.extensionsUsed.includes("KHR_materials_transmission"));
  assert.ok(result.extensionsUsed.includes("KHR_materials_ior"));
  assert.ok(result.extensionsUsed.includes("KHR_materials_volume"));

  const { NodeIO } = await import("@gltf-transform/core");
  const { KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsVolume } = await import(
    "@gltf-transform/extensions"
  );
  const io = new NodeIO().registerExtensions([
    KHRMaterialsTransmission,
    KHRMaterialsIOR,
    KHRMaterialsVolume,
  ]);
  const doc = await io.readBinary(result.buffer);
  const [gem, gold] = doc.getRoot().listMaterials();

  const tx = gem.getExtension("KHR_materials_transmission") as {
    getTransmissionFactor(): number;
  } | null;
  assert.ok(tx);
  assert.ok(Math.abs(tx!.getTransmissionFactor() - 0.88) < 0.001);
  assert.equal(gem.getMetallicFactor(), 0);
  assert.equal(gem.getAlphaMode(), "OPAQUE");

  const ior = gem.getExtension("KHR_materials_ior") as { getIOR(): number } | null;
  assert.ok(ior);
  assert.ok(Math.abs(ior!.getIOR() - 2.42) < 0.001);

  const vol = gem.getExtension("KHR_materials_volume") as {
    getThicknessFactor(): number;
  } | null;
  assert.ok(vol);
  assert.ok(Math.abs(vol!.getThicknessFactor() - 0.35) < 0.001);

  assert.equal(gold.getExtension("KHR_materials_transmission"), null);
});
