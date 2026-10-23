# Aset Blender

Semua aset 3D dibuat oleh script Python yang dijalankan Blender tanpa jendela (headless). Tidak ada yang dimodelkan dengan tangan, jadi setiap aset bisa dibangun ulang dari nol dengan hasil yang sama.

Blender tidak ada di PATH. Panggil langsung:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --version
```

## Membangun ulang ruangan (tahap 3)

```bash
python3 -I blender/scripts/fetch_textures.py   # sekali saja: download tekstur CC0 (~106 MB)
blender/build_room.sh                           # model → preview → bake lightmap → GLB → KTX2
```

`build_room.sh` menerima jumlah sample bake, misalnya `blender/build_room.sh 64` untuk percobaan cepat (sekitar 6 menit). Tanpa angka, defaultnya 1024 sample untuk hasil final yang lebih halus.

Hasilnya:

| File | Isi |
|---|---|
| `public/models/room.glb` | Semua mesh ruangan, material PBR (tekstur KTX2), dan UV kedua untuk lightmap |
| `public/models/room-lm-{a,b}-{base,lamp,screen}.ktx2` | Lightmap hasil bake: atlas A untuk dinding/lantai/plafon, atlas B untuk isi ruangan |
| `public/models/room-probe.webp` | Panorama ruangan, dipakai untuk pantulan di kaca CRT, gelas, dan logam |
| `public/models/crt-smudge.webp` | Sidik jari (R) dan debu (G) untuk kaca monitor |
| `blender/previews/room.png` | Render preview Cycles dari sudut kamera website |

## Membangun ulang dunia di bawah ruangan

Tiga script ini tidak butuh bake lightmap, jadi cepat (masing-masing beberapa menit, kecuali bake AO pertama yang harus mengompilasi kernel Cycles):

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup -P blender/scripts/crt.py      # monitor CRT gantung untuk dunia project
$B -b --factory-startup -P blender/scripts/spiral.py   # pilar kabel, pilar jauh, kabel menjuntai, menara TV
$B -b --factory-startup -P blender/scripts/depths.py   # lantai banjir, bohlam, problem, keycap, kaset, reruntuhan
npm run textures                                       # lalu semua teksturnya jadi KTX2 (lihat di bawah)
```

| File | Isi |
|---|---|
| `public/models/crt.glb` + `crt-ao.ktx2` | Satu CRT 19" ukuran asli dengan tali, baut mata, dan kabel 10 m; AO di-bake ke UV kedua. Web membesarkannya 4,5× |
| `public/models/spiral.glb` + `spiral-probe.webp` | Dunia project (dikompres Draco): 130 kabel basah yang terpilin, relik yang terjepit di dalamnya, sarang di atas, 9 pilar jauh, kabel menjuntai, dan 8 menara TV. Probe-nya panorama untuk pantulan |
| `public/models/depths.glb` | Dasar: lantai, reruntuhan, TV tenggelam, bohlam (3×), 10 problem, 1 keycap, 1 kaset + sampulnya, 6 bongkahan lantai untuk adegan jatuh |

Decoder Draco di-host sendiri di `public/draco/` (disalin dari `three/examples/jsm/libs/draco/gltf/`).

## Kompres tekstur (KTX2)

Blender mengekspor tekstur sebagai WebP. File WebP kecil, tapi di GPU tiap pixel tetap makan 4 byte, dan browser juga menyimpan salinan hasil decode-nya di RAM. Total semua bab tadinya sekitar 2 GB. Kalau Mac kekurangan RAM, macOS mengompres tekstur bab yang lama tidak dipakai, lalu frame pertama yang memakainya lagi tersendat.

`npm run textures` (`scripts/compress_textures.mjs`) mengubah semua tekstur di `public/models` menjadi KTX2 (Basis Universal), format yang tetap terkompres di GPU:

- **ETC1S** untuk warna, ORM, dan normal map: ukuran file kira-kira sama dengan WebP, dan di GPU hanya 4 bit per pixel.
- **UASTC** untuk lightmap dan AO: gradasinya halus, dan ETC1S akan memperlihatkan kotak-kotak. Filenya lebih besar, di GPU 8 bit per pixel.

Gambar di dalam GLB ditukar langsung dan sisa file disalin apa adanya, jadi mesh Draco tidak perlu di-decode. Lightmap dan AO yang berdiri sendiri (`.webp` dari `bake.py` dan `crt.py`) diganti `.ktx2`. Gambar yang sudah KTX2 dilewati, jadi script ini aman dijalankan berkali-kali. Jalankan setiap kali selesai mengekspor ulang dari Blender. `build_room.sh` sudah menjalankannya sendiri di akhir.

Tekstur yang sama di beberapa model (misalnya plastik CRT di monitor meja, CRT gantung, dan TV tenggelam) di-encode sekali dan diberi nama yang sama. Web memakai nama itu untuk menyimpan satu salinan saja (`src/experience/materials/sharedTextures.ts`).

Transcoder Basis di-host sendiri di `public/basis/` (disalin dari `three/examples/jsm/libs/basis/`). Probe panorama (`*-probe.webp`) dan `crt-smudge.webp` tetap WebP karena kecil, dan probe dibaca three.js sebagai panorama equirect.

## Urutan script

| Script | Tugas |
|---|---|
| `scripts/common.py` | Helper bersama: koordinat three.js → Blender (`V()`), primitif ber-bevel, material PBR, UV |
| `scripts/textures.py` | Mencari tekstur yang sudah di-download, lalu membuat turunannya (warna di-tint, peta ORM) |
| `scripts/art.py` | Gambar buatan sendiri: jaring laba-laba, poster, coretan sticky note, atlas sampul dan punggung 16 buku |
| `scripts/room.py` | Membangun ruangan, material, dan lampu untuk bake → `blender/source/room.blend` |
| `scripts/render_preview.py` | Render preview dari kamera `RoomCam` (posisi `ROOM_START` di web) |
| `scripts/bake.py` | Membuat UV lightmap, bake 3 lampu terpisah, denoise, simpan WebP → `room_baked.blend` |
| `scripts/export.py` | Ekspor koleksi `Room` ke GLB |
| `scripts/compress_textures.mjs` | Node, bukan Blender: semua tekstur hasil ekspor → KTX2 (`npm run textures`) |
| `scripts/crt_model.py` | Model CRT bersama: dipakai monitor di meja, CRT gantung, dan TV yang tenggelam |
| `scripts/crt.py` | CRT gantung → `crt.glb` |
| `scripts/spiral.py` | Dunia project → `spiral.glb` |
| `scripts/depths.py` | Dasar dan semua benda di bab About, Stack, Contact → `depths.glb` |

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
  - `runtime` menandai mesh yang materialnya diganti di web (`screen`, `bulb`, `filament`, `led`, `glass`, `cobweb`, `decal`, `tower-screen`, `reflector`, `problem-glow`, `problem-screen`, `keycap-legend`, `cassette-label`, `cassette-window`).
  - `atlas` (`A`/`B`) menunjukkan lightmap yang dipakai.
- Scene menyimpan `lamp_bulb`, `moon_dir`, dan skala lightmap (`lightmaps`). Web membacanya dari `scene.userData`, jadi angka di Blender dan di web selalu sama.

Sumber dan lisensi tekstur ada di [`assets-src/CREDITS.md`](assets-src/CREDITS.md).
