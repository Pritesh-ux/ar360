import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const ACCEPTED_MODEL_EXTENSIONS = [".glb", ".obj", ".fbx"] as const;
export type AcceptedModelExtension = (typeof ACCEPTED_MODEL_EXTENSIONS)[number];

export const CONVERTIBLE_MODEL_EXTENSIONS = [".obj", ".fbx"] as const;
export type ConvertibleModelExtension = (typeof CONVERTIBLE_MODEL_EXTENSIONS)[number];

/** Max source size before conversion (matches GLB cap). */
export const MAX_SOURCE_MODEL_BYTES = 2 * 1024 * 1024 * 1024;

const DEFAULT_CONVERT_TIMEOUT_MS = 240_000;

export class ModelConversionError extends Error {
  readonly code: "UNSUPPORTED" | "BLENDER_MISSING" | "CONVERSION_FAILED" | "TIMEOUT";

  constructor(
    code: ModelConversionError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ModelConversionError";
    this.code = code;
  }
}

export function modelExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function isAcceptedModelExtension(ext: string): ext is AcceptedModelExtension {
  return (ACCEPTED_MODEL_EXTENSIONS as readonly string[]).includes(ext);
}

export function isConvertibleModelExtension(ext: string): ext is ConvertibleModelExtension {
  return (CONVERTIBLE_MODEL_EXTENSIONS as readonly string[]).includes(ext);
}

function resolveBlenderPath(): string {
  const configured = String(process.env.BLENDER_PATH || "").trim();
  if (configured) {
    if (/\.(bat|cmd)$/i.test(configured)) {
      throw new ModelConversionError(
        "BLENDER_MISSING",
        "BLENDER_PATH must point to blender.exe (not a .bat/.cmd launcher).",
      );
    }
    return configured;
  }
  return process.platform === "win32" ? "blender.exe" : "blender";
}

function convertTimeoutMs(): number {
  const raw = Number(process.env.MODEL_CONVERT_TIMEOUT_MS || DEFAULT_CONVERT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 5_000) return DEFAULT_CONVERT_TIMEOUT_MS;
  return Math.min(raw, 280_000);
}

const BLENDER_CONVERT_SCRIPT = `
import bpy, os, sys

args = sys.argv[sys.argv.index("--") + 1:]
source, target = args[0], args[1]
ext = os.path.splitext(source)[1].lower()

bpy.ops.wm.read_factory_settings(use_empty=True)

if ext == ".obj":
    bpy.ops.wm.obj_import(filepath=source)
elif ext == ".fbx":
    try:
        bpy.ops.wm.fbx_import(filepath=source)
    except Exception:
        bpy.ops.import_scene.fbx(filepath=source)
elif ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=source)
else:
    raise RuntimeError(f"Unsupported source extension: {ext}")

if not bpy.context.scene.objects:
    raise RuntimeError("Import produced no objects")

try:
    bpy.ops.file.pack_all()
except Exception:
    pass

export_kwargs = dict(
    filepath=target,
    export_format="GLB",
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
)
try:
    bpy.ops.export_scene.gltf(**export_kwargs)
except TypeError:
    bpy.ops.export_scene.gltf(filepath=target, export_format="GLB", export_apply=True)

if not os.path.isfile(target) or os.path.getsize(target) < 20:
    raise RuntimeError("Blender did not produce a GLB")
`;

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
}

async function runBlenderConvert(input: {
  blender: string;
  workDir: string;
  scriptPath: string;
  sourcePath: string;
  targetPath: string;
  timeoutMs: number;
}): Promise<{ exitCode: number; output: string }> {
  const output: string[] = [];
  let timedOut = false;

  const child = spawn(
    input.blender,
    ["--background", "--python", input.scriptPath, "--", input.sourcePath, input.targetPath],
    {
      cwd: input.workDir,
      env: process.env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const push = (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (!text) return;
    output.push(text);
    if (output.length > 80) output.splice(0, output.length - 80);
  };
  child.stdout?.on("data", push);
  child.stderr?.on("data", push);

  const timer = setTimeout(() => {
    timedOut = true;
    void terminateProcessTree(child);
  }, input.timeoutMs);
  timer.unref();

  const exitCode: number = await new Promise((resolve, reject) => {
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

  if (timedOut) {
    throw new ModelConversionError(
      "TIMEOUT",
      "Model conversion timed out. Try a smaller file or export as .glb.",
    );
  }

  return { exitCode, output: output.join("\n") };
}

/**
 * Returns a GLB buffer. Passthrough for .glb; Blender headless convert for .obj/.fbx.
 * Source formats are never stored — only the resulting GLB is.
 */
export async function ensureGlbBuffer(input: {
  buffer: Buffer;
  fileName: string;
}): Promise<{ buffer: Buffer; converted: boolean; sourceExt: AcceptedModelExtension }> {
  const sourceExt = modelExtension(input.fileName);
  if (!isAcceptedModelExtension(sourceExt)) {
    throw new ModelConversionError(
      "UNSUPPORTED",
      `Unsupported model type "${sourceExt}". Allowed: .glb, .obj, .fbx`,
    );
  }

  if (sourceExt === ".glb") {
    return { buffer: input.buffer, converted: false, sourceExt };
  }

  const blender = resolveBlenderPath();
  const workDir = await mkdtemp(path.join(tmpdir(), "ar360-model-convert-"));
  const safeBase = path.basename(input.fileName).replace(/[^\w.\-]+/g, "_") || `model${sourceExt}`;
  const sourcePath = path.join(workDir, safeBase.endsWith(sourceExt) ? safeBase : `${safeBase}${sourceExt}`);
  const scriptPath = path.join(workDir, "convert-to-glb.py");
  const targetPath = path.join(workDir, "model.glb");

  try {
    await writeFile(sourcePath, input.buffer);
    await writeFile(scriptPath, BLENDER_CONVERT_SCRIPT, "utf8");

    let result: { exitCode: number; output: string };
    try {
      result = await runBlenderConvert({
        blender,
        workDir,
        scriptPath,
        sourcePath,
        targetPath,
        timeoutMs: convertTimeoutMs(),
      });
    } catch (err) {
      if (err instanceof ModelConversionError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/ENOENT|not found|spawn/i.test(msg)) {
        throw new ModelConversionError(
          "BLENDER_MISSING",
          "Blender is required to convert OBJ/FBX. Set BLENDER_PATH on the server.",
        );
      }
      throw new ModelConversionError(
        "CONVERSION_FAILED",
        `Could not convert ${sourceExt.toUpperCase()} to GLB: ${msg}`,
      );
    }

    if (result.exitCode !== 0) {
      const tail = result.output.slice(-800);
      throw new ModelConversionError(
        "CONVERSION_FAILED",
        `Could not convert ${sourceExt.toUpperCase()} to GLB.${tail ? ` ${tail}` : ""}`,
      );
    }

    const glb = await readFile(targetPath);
    if (glb.length < 20) {
      throw new ModelConversionError(
        "CONVERSION_FAILED",
        `Could not convert ${sourceExt.toUpperCase()} to GLB (empty output).`,
      );
    }

    return { buffer: glb, converted: true, sourceExt };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
