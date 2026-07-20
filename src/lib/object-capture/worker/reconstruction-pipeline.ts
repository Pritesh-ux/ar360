import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGlbUpload } from "@/lib/products/glb-validator";
import { createStorageKey, ensureJobFolders } from "../workspace";
import { parsePercent, runCommand, type CommandSpec } from "./command-runner";

export type ReconstructionConfig = {
  colmap: string;
  interfaceColmap: string;
  densifyPointCloud: string;
  reconstructMesh: string;
  refineMesh: string;
  textureMesh: string;
  blender: string;
  stageTimeoutMs: number;
};

export type PipelineStage = {
  name: string;
  progressStart: number;
  progressEnd: number;
  spec: CommandSpec;
};

export type PipelineHooks = {
  signal: AbortSignal;
  onProgress: (stage: string, progress: number, message?: string) => void | Promise<void>;
};

function executable(envName: string, fallback: string) {
  const value = process.env[envName]?.trim() || fallback;
  if (!value) throw new Error(`${envName} is required`);
  if (process.platform === "win32" && /\.(bat|cmd)$/i.test(value)) {
    throw new Error(`${envName} must point to an executable, not a batch file (shell execution is disabled).`);
  }
  return value;
}

export function loadReconstructionConfig(): ReconstructionConfig {
  const stageTimeoutMs = Number(process.env.OC_STAGE_TIMEOUT_MS || 2 * 60 * 60 * 1000);
  if (!Number.isFinite(stageTimeoutMs) || stageTimeoutMs < 1000) {
    throw new Error("OC_STAGE_TIMEOUT_MS must be at least 1000");
  }
  return {
    colmap: executable("COLMAP_PATH", process.platform === "win32" ? "colmap.exe" : "colmap"),
    interfaceColmap: executable("OPENMVS_INTERFACE_COLMAP_PATH", "InterfaceCOLMAP"),
    densifyPointCloud: executable("OPENMVS_DENSIFY_PATH", "DensifyPointCloud"),
    reconstructMesh: executable("OPENMVS_RECONSTRUCT_PATH", "ReconstructMesh"),
    refineMesh: executable("OPENMVS_REFINE_PATH", "RefineMesh"),
    textureMesh: executable("OPENMVS_TEXTURE_PATH", "TextureMesh"),
    blender: executable("BLENDER_PATH", "blender"),
    stageTimeoutMs,
  };
}

export function buildReconstructionStages(input: {
  config: ReconstructionConfig;
  original: string;
  work: string;
  blenderScript: string;
  glbTemp: string;
}): PipelineStage[] {
  const { config, original, work, blenderScript, glbTemp } = input;
  const database = path.join(work, "colmap.db");
  const sparse = path.join(work, "sparse");
  const dense = path.join(work, "dense");
  const scene = path.join(work, "scene.mvs");
  const denseScene = path.join(work, "scene_dense.mvs");
  const meshScene = path.join(work, "scene_dense_mesh.mvs");
  const refinedScene = path.join(work, "scene_dense_mesh_refine.mvs");
  const texturedScene = path.join(work, "scene_dense_mesh_refine_texture.mvs");
  const texturedObj = path.join(work, "scene_dense_mesh_refine_texture.obj");
  const spec = (command: string, args: string[]): CommandSpec => ({
    command, args, cwd: work, timeoutMs: config.stageTimeoutMs,
  });
  return [
    {
      name: "colmap_features", progressStart: 30, progressEnd: 38,
      spec: spec(config.colmap, [
        "feature_extractor", "--database_path", database, "--image_path", original,
        "--ImageReader.single_camera", "1",
      ]),
    },
    {
      name: "colmap_matching", progressStart: 38, progressEnd: 46,
      spec: spec(config.colmap, ["exhaustive_matcher", "--database_path", database]),
    },
    {
      name: "colmap_mapping", progressStart: 46, progressEnd: 56,
      spec: spec(config.colmap, [
        "mapper", "--database_path", database, "--image_path", original, "--output_path", sparse,
      ]),
    },
    {
      name: "colmap_undistort", progressStart: 56, progressEnd: 62,
      spec: spec(config.colmap, [
        "image_undistorter", "--image_path", original, "--input_path", path.join(sparse, "0"),
        "--output_path", dense, "--output_type", "COLMAP",
      ]),
    },
    {
      name: "openmvs_interface", progressStart: 62, progressEnd: 66,
      spec: spec(config.interfaceColmap, ["-i", dense, "-o", scene]),
    },
    {
      name: "openmvs_densify", progressStart: 66, progressEnd: 76,
      spec: spec(config.densifyPointCloud, [scene, "-o", denseScene]),
    },
    {
      name: "openmvs_mesh", progressStart: 76, progressEnd: 83,
      spec: spec(config.reconstructMesh, [denseScene, "-o", meshScene]),
    },
    {
      name: "openmvs_refine", progressStart: 83, progressEnd: 88,
      spec: spec(config.refineMesh, [meshScene, "-o", refinedScene]),
    },
    {
      name: "openmvs_texture", progressStart: 88, progressEnd: 94,
      spec: spec(config.textureMesh, [refinedScene, "-o", texturedScene]),
    },
    {
      name: "blender_export", progressStart: 94, progressEnd: 98,
      spec: spec(config.blender, [
        "--background", "--python", blenderScript, "--", texturedObj, glbTemp,
      ]),
    },
  ];
}

const BLENDER_EXPORT_SCRIPT = `
import bpy, os, sys
args = sys.argv[sys.argv.index("--") + 1:]
source, target = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=source)
if not bpy.context.scene.objects:
    raise RuntimeError("OpenMVS OBJ contains no objects")
bpy.ops.export_scene.gltf(filepath=target, export_format='GLB', export_apply=True)
if not os.path.isfile(target) or os.path.getsize(target) < 20:
    raise RuntimeError("Blender did not produce a GLB")
`;

export async function runReconstructionPipeline(
  customerUid: string,
  jobId: string,
  leaseToken: string,
  hooks: PipelineHooks,
) {
  const paths = await ensureJobFolders(customerUid, jobId);
  const work = path.join(paths.processed, `attempt-${leaseToken}`);
  const publishDir = paths.output;
  await mkdir(path.join(work, "sparse"), { recursive: true });
  await mkdir(publishDir, { recursive: true });

  const sourceFiles = (await readdir(paths.original)).filter((name) => /\.(jpe?g|png)$/i.test(name));
  if (sourceFiles.length < 20) throw new Error("At least 20 JPEG or PNG source images are required.");

  const blenderScript = path.join(work, "export-glb.py");
  const glbTemp = path.join(publishDir, `.model-${leaseToken}.tmp.glb`);
  const glbName = `model-${leaseToken}.glb`;
  const glbFinal = path.join(publishDir, glbName);
  await writeFile(blenderScript, BLENDER_EXPORT_SCRIPT, "utf8");

  const stages = buildReconstructionStages({
    config: loadReconstructionConfig(), original: paths.original, work, blenderScript, glbTemp,
  });
  for (const stage of stages) {
    await hooks.onProgress(stage.name, stage.progressStart);
    let lastReported = stage.progressStart;
    await runCommand(stage.spec, {
      signal: hooks.signal,
      onLine: async (line) => {
        const percent = parsePercent(line);
        const mapped = percent === null
          ? lastReported
          : stage.progressStart + ((stage.progressEnd - stage.progressStart) * percent) / 100;
        if (mapped >= lastReported + 1 || percent === null) {
          lastReported = mapped;
          await hooks.onProgress(stage.name, mapped, line);
        }
      },
    });
    await hooks.onProgress(stage.name, stage.progressEnd);
  }

  const fileStat = await stat(glbTemp);
  const buffer = await readFile(glbTemp);
  const validation = validateGlbUpload({
    buffer, fileName: glbName, mimeType: "model/gltf-binary", sizeBytes: fileStat.size,
  });
  if (validation.ok === false) throw new Error(`GLB validation failed: ${validation.message}`);
  await rename(glbTemp, glbFinal);
  return {
    modelKey: createStorageKey(jobId, "output", glbName),
    modelUrl: `/api/object-capture/jobs/${jobId}/assets/model`,
    validation,
  };
}
