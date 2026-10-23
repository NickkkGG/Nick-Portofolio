# Aset Blender

Semua aset 3D dibuat oleh script Python yang dijalankan Blender tanpa jendela (headless). Tidak ada yang dimodelkan dengan tangan, jadi setiap aset bisa dibangun ulang dari nol dengan hasil yang sama.

Blender tidak ada di PATH. Panggil langsung:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --version
```

## Membangun ulang ruangan (tahap 3)

```bash
python3 -I blender/scripts/fetch_textures.py   # sekali saja: download tekstur CC0 (~106 MB)
blender/build_room.sh                           # model → preview → bake lightmap → GLB
```

`build_room.sh` menerima jumlah sample bake, misalnya `blender/build_room.sh 64` untuk percobaan cepat (sekitar 6 menit). Tanpa angka, defaultnya 1024 sample untuk hasil final yang lebih halus.

Hasilnya:

| File | Isi |
|---|---|
| `public/models/room.glb` | Semua mesh ruangan, material PBR (tekstur WebP), dan UV kedua untuk lightmap |
| `public/models/room-lm-{a,b}-{base,lamp,screen}.webp` | Lightmap hasil bake: atlas A untuk dinding/lantai/plafon, atlas B untuk isi ruangan |
| `public/models/room-probe.webp` | Panorama ruangan, dipakai untuk pantulan di kaca CRT, gelas, dan logam |
| `public/models/crt-smudge.webp` | Sidik jari (R) dan debu (G) untuk kaca monitor |
| `blender/previews/room.png` | Render preview Cycles dari sudut kamera website |

## Urutan script

| Script | Tugas |
|---|---|
| `scripts/common.py` | Helper bersama: koordinat three.js → Blender (`V()`), primitif ber-bevel, material PBR, UV |
| `scripts/textures.py` | Mencari tekstur yang sudah di-download, lalu membuat turunannya (warna di-tint, peta ORM) |
| `scripts/art.py` | Gambar buatan sendiri: jaring laba-laba, poster, coretan sticky note |
| `scripts/room.py` | Membangun ruangan, material, dan lampu untuk bake → `blender/source/room.blend` |
| `scripts/render_preview.py` | Render preview dari kamera `RoomCam` (posisi `ROOM_START` di web) |
| `scripts/bake.py` | Membuat UV lightmap, bake 3 lampu terpisah, denoise, simpan WebP → `room_baked.blend` |
| `scripts/export.py` | Ekspor koleksi `Room` ke GLB |

## Kenapa lightmap-nya tiga

Cahaya di-bake per sumber supaya web bisa mencampurnya secara live:

- **base**: cahaya bulan dan langit malam dari jendela.
- **lamp**: lampu meja saja, dalam warna putih. Web mewarnainya dan membuatnya berkedip (`src/experience/flicker.ts`). Di loop 2 nanti lampunya bisa merah tanpa bake ulang.
- **screen**: cahaya monitor saja, dalam warna putih.

Bake hanya menyimpan cahaya (tanpa warna permukaan). Web mengalikannya dengan tekstur tiap material (`src/experience/chapters/room/lighting.ts`). Jadi tekstur tetap tajam, cahaya tetap lembut.

## Konvensi

- Posisi ditulis dalam koordinat three.js (meter, Y ke atas, −Z ke dinding belakang), lewat `V(x, y, z)`. Exporter glTF mengubahnya balik ke Y-up.
- Custom property di objek ikut terekspor sebagai `userData` di three.js:
  - `knock: 1` menandai dinding/plafon yang bisa diketuk.
  - `runtime` menandai mesh yang materialnya diganti di web (`screen`, `bulb`, `filament`, `led`, `glass`, `cobweb`, `decal`).
  - `atlas` (`A`/`B`) menunjukkan lightmap yang dipakai.
- Scene menyimpan `lamp_bulb`, `moon_dir`, dan skala lightmap (`lightmaps`). Web membacanya dari `scene.userData`, jadi angka di Blender dan di web selalu sama.

Sumber dan lisensi tekstur ada di [`assets-src/CREDITS.md`](assets-src/CREDITS.md).
