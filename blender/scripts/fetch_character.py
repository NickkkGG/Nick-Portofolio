"""Downloads what the character is made from: the MPFB add-on and the MakeHuman system assets.

Run with plain Python (not Blender), isolated so nothing in the download folders
can be imported:

    python3 -I blender/scripts/fetch_character.py

MPFB 2 (GPL-3.0-or-later) is the MakeHuman add-on for Blender; character.py only runs it.
The asset pack (CC0) holds the skins, eyes, eyebrows, hair, clothes and proxies. Files land
in blender/assets-src/character/ (git-ignored). Each is checked against its size, the add-on
also against its SHA-256, so the script can be re-run safely.
"""

import hashlib
import pathlib
import shutil
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "blender" / "assets-src" / "character"

FILES = [
    {
        "url": "https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip",
        "target": OUT / "mpfb" / "add-on-mpfb-v2.0.18.zip",
        "size": 45956992,
        "sha256": "c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad",
    },
    {
        "url": "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
        "target": OUT / "makehuman" / "makehuman_system_assets_cc0.zip",
        "size": 280737770,
    },
]


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def download(file: dict) -> None:
    target, size = file["target"], file["size"]
    if target.exists() and target.stat().st_size == size:
        print(f"  ok   {target.name}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(file["url"], headers={"User-Agent": "portfolio-asset-fetch/1.0"})
    with urllib.request.urlopen(request) as response, open(partial, "wb") as out:
        shutil.copyfileobj(response, out)
    got = partial.stat().st_size
    if got != size:
        partial.unlink()
        raise SystemExit(f"{target.name}: expected {size} bytes, got {got}")
    if "sha256" in file and sha256(partial) != file["sha256"]:
        partial.unlink()
        raise SystemExit(f"{target.name}: checksum mismatch")
    partial.rename(target)
    print(f"  got  {target.name} ({size / 1e6:.1f} MB)")


def main() -> None:
    for file in FILES:
        download(file)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
