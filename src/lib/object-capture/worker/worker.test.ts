import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parsePercent, runCommand } from "./command-runner";
import {
  buildReconstructionStages,
  loadReconstructionConfig,
  type ReconstructionConfig,
} from "./reconstruction-pipeline";

test("progress parser accepts tool percentages and clamps invalid ranges", () => {
  assert.equal(parsePercent("Processed 42.5%"), 42.5);
  assert.equal(parsePercent("[====] 101%"), 100);
  assert.equal(parsePercent("no progress here"), null);
});

test("command runner passes metacharacters as arguments without a shell", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "oc-runner-"));
  try {
    const marker = "literal && echo NOT_EXECUTED";
    const result = await runCommand({
      command: process.execPath,
      args: ["-e", "console.log(process.argv[1])", marker],
      cwd,
      timeoutMs: 5_000,
    });
    assert.match(result.output, /literal && echo NOT_EXECUTED/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("reconstruction stages include COLMAP, every OpenMVS stage, and Blender", () => {
  const config: ReconstructionConfig = {
    colmap: "colmap",
    interfaceColmap: "InterfaceCOLMAP",
    densifyPointCloud: "DensifyPointCloud",
    reconstructMesh: "ReconstructMesh",
    refineMesh: "RefineMesh",
    textureMesh: "TextureMesh",
    blender: "blender",
    stageTimeoutMs: 1000,
  };
  const stages = buildReconstructionStages({
    config,
    original: "/input",
    work: "/work",
    blenderScript: "/work/export.py",
    glbTemp: "/output/model.tmp",
  });
  assert.deepEqual(stages.map((stage) => stage.name), [
    "colmap_features",
    "colmap_matching",
    "colmap_mapping",
    "colmap_undistort",
    "openmvs_interface",
    "openmvs_densify",
    "openmvs_mesh",
    "openmvs_refine",
    "openmvs_texture",
    "blender_export",
  ]);
  assert.equal(stages.every((stage) => stage.spec.timeoutMs === 1000), true);
});

test("reconstruction config rejects unsafe stage timeout values", () => {
  const previous = process.env.OC_STAGE_TIMEOUT_MS;
  process.env.OC_STAGE_TIMEOUT_MS = "999";
  try {
    assert.throws(() => loadReconstructionConfig(), /at least 1000/);
  } finally {
    if (previous === undefined) delete process.env.OC_STAGE_TIMEOUT_MS;
    else process.env.OC_STAGE_TIMEOUT_MS = previous;
  }
});
