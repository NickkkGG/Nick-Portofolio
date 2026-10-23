#!/usr/bin/env bash
# Rebuilds the room from nothing: geometry, preview, light bake, GLB.
#   blender/build_room.sh [samples]     (samples per texel for the bake, default 1024)
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
SAMPLES=${1:-1024}
"$BLENDER" -b --factory-startup -P blender/scripts/room.py
"$BLENDER" -b blender/source/room.blend -P blender/scripts/render_preview.py -- room 128
"$BLENDER" -b blender/source/room.blend -P blender/scripts/bake.py -- "$SAMPLES"
"$BLENDER" -b blender/source/room_baked.blend -P blender/scripts/export.py
