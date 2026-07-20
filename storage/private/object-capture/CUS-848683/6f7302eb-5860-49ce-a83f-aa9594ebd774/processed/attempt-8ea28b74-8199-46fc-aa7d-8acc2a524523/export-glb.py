
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
