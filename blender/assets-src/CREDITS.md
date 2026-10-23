# Credits

Semua tekstur di bawah berlisensi **CC0 1.0** (public domain): boleh dipakai, diubah, dan dipublikasikan tanpa atribusi. Daftar ini tetap dicatat supaya sumbernya jelas.

File aslinya tidak ikut masuk git. Download ulang dengan:

```bash
python3 -I blender/scripts/fetch_textures.py
```

Script itu membaca `textures.json` (URL dan ukuran tiap file).

## Poly Haven (https://polyhaven.com/license)

| Aset | URL | Dipakai untuk |
|---|---|---|
| Worn Plaster Wall | https://polyhaven.com/a/worn_plaster_wall | dinding dan plafon |
| Concrete Floor Worn 001 | https://polyhaven.com/a/concrete_floor_worn_001 | lantai ruangan, lantai banjir di dasar, reruntuhan, atap |
| Wood Table Worn | https://polyhaven.com/a/wood_table_worn | meja, rak, lemari |
| Green Metal Rust | https://polyhaven.com/a/green_metal_rust | lampu meja, kusen jendela, radiator, siku rak |
| Dirty Carpet | https://polyhaven.com/a/dirty_carpet | karpet |

## ambientCG (https://docs.ambientcg.com/license/)

| Aset | URL | Dipakai untuk |
|---|---|---|
| Plastic 018 B | https://ambientcg.com/a/Plastic018B | casing CRT, keyboard, PC, kerai, list dinding, keycap, rambu peringatan |
| Plastic 012 B | https://ambientcg.com/a/Plastic012B | plastik hitam: kursi, kabel, bezel, kabel pilar, kaset |
| Leather 032 | https://ambientcg.com/a/Leather032 | kulit kursi |
| Paper 003 | https://ambientcg.com/a/Paper003 | poster, kertas, buku |
| Cardboard 003 | https://ambientcg.com/a/Cardboard003 | kardus di rak, sampul kaset VHS |
| Fingerprints 002 | https://ambientcg.com/a/Fingerprints002 | sidik jari di kaca CRT |
| Surface Imperfections 015 | https://ambientcg.com/a/SurfaceImperfections015 | lapisan debu |
| Leaking 007 | https://ambientcg.com/a/Leaking007 | noda lembap di dinding |
| Leaking 008 | https://ambientcg.com/a/Leaking008 | noda lembap di dinding |

## Dibuat sendiri

Gambar berikut dibuat oleh script di `blender/scripts/art.py`, bukan diambil dari mana pun:
- poster "DO NOT ADJUST YOUR SET" (dirender dengan font Inter bawaan Blender, lisensi OFL)
- jaring laba-laba
- coretan di sticky note dan label kaset VHS
- sampul dan punggung 16 buku dengan judul karangan sendiri (font Inter dan DejaVu Sans Mono bawaan Blender, keduanya berlisensi bebas)

Di web, beberapa gambar juga digambar langsung di canvas, tanpa file: legenda keycap, pesan error di jendela problem, dan label tulisan tangan di kaset (font tulisan tangan bawaan sistem). Transisi kaca antar bab memakai ulang `crt-smudge.webp` (dari Fingerprints 002).
