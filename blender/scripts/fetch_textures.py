"""Downloads the CC0 textures listed in blender/assets-src/textures.json.

Run with plain Python (not Blender), isolated so nothing in the download folder
can be imported:

    python3 -I blender/scripts/fetch_textures.py

Files land in blender/assets-src/textures/<source>/<id>/ (git-ignored). Existing
files with the expected size are skipped, so the script can be re-run safely.
"""

import json
import pathlib
import shutil
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "blender" / "assets-src" / "textures.json"
OUT = ROOT / "blender" / "assets-src" / "textures"

POLYHAVEN_URL = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{id}/{file}"
AMBIENTCG_URL = "https://ambientcg.com/get?file={file}"


def download(url: str, target: pathlib.Path, size: int) -> None:
    if target.exists() and target.stat().st_size == size:
        print(f"  ok   {target.name}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "portfolio-asset-fetch/1.0"})
    with urllib.request.urlopen(request) as response, open(partial, "wb") as out:
        shutil.copyfileobj(response, out)
    got = partial.stat().st_size
    if got != size:
        partial.unlink()
        raise SystemExit(f"{target.name}: expected {size} bytes, got {got}")
    partial.rename(target)
    print(f"  got  {target.name} ({size / 1e6:.1f} MB)")


def unzip(archive: pathlib.Path, folder: pathlib.Path) -> None:
    with zipfile.ZipFile(archive) as zf:
        for member in zf.infolist():
            name = pathlib.PurePosixPath(member.filename).name
            # Flat image files only: nothing may escape the asset folder.
            if member.is_dir() or not name or name.startswith(".") or not name.lower().endswith((".jpg", ".png")):
                continue
            with zf.open(member) as src, open(folder / name, "wb") as dst:
                shutil.copyfileobj(src, dst)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    for asset in manifest["polyhaven"]:
        print(f"polyhaven/{asset['id']}")
        for file, size in asset["files"].items():
            download(POLYHAVEN_URL.format(id=asset["id"], file=file), OUT / "polyhaven" / asset["id"] / file, size)
    for asset in manifest["ambientcg"]:
        print(f"ambientcg/{asset['id']}")
        folder = OUT / "ambientcg" / asset["id"]
        archive = folder / asset["file"]
        download(AMBIENTCG_URL.format(file=asset["file"]), archive, asset["size"])
        unzip(archive, folder)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
