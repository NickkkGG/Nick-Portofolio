#!/usr/bin/env bash
# Builds the character from MakeHuman assets with MPFB: model, rig, poses, GLB, KTX2 textures.
#   python3 -I blender/scripts/fetch_character.py    (once: the add-on and the asset pack)
#   blender/build_character.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
# MPFB and its assets live in a Blender user folder of their own, never in yours.
export BLENDER_USER_RESOURCES="$PWD/blender/assets-src/character/blender-user"
if [ ! -d "$BLENDER_USER_RESOURCES/extensions/user_default/mpfb" ]; then
  mkdir -p "$BLENDER_USER_RESOURCES"
  "$BLENDER" --command extension install-file -r user_default -e blender/assets-src/character/mpfb/add-on-mpfb-v2.0.18.zip
fi
"$BLENDER" -b --factory-startup -P blender/scripts/character.py
"$BLENDER" -b blender/source/character.blend -P blender/scripts/character_preview.py
node blender/scripts/compress_textures.mjs
