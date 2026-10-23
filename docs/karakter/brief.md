# Brief karakter (tahap 2)

Karakternya **tidak perlu mirip kamu**. Gayanya **agak smooth dengan tekstur realistis**, bukan low-poly kotak-kotak:
- Sekitar 20–40 ribu segitiga, tekstur PBR 2K–4K, supaya nyatu dengan ruangan yang realistis.
- Karakter ini lebih sering terlihat dari belakang atau sebagai siluet: duduk di depan CRT, jatuh telentang, berdiri di pilar. Jadi yang paling penting hoodie, headphone, rambut, dan siluetnya. Wajah cukup rapi dan netral.

## Cara generate

Pakai salah satu: **Meshy** (meshy.ai), **Rodin** (hyper3d.ai), atau **Tripo** (tripo3d.ai). Coba versi gratisnya dulu. Kamu yang bikin akun dan download (aku tidak boleh login atau bikin akun).

1. Pilih **Text to 3D**, lalu tempel prompt di bawah (bahasa Inggris, karena tools-nya paling paham bahasa Inggris).
2. Pengaturan (namanya bisa beda sedikit di tiap tools):
   - Gaya: **Realistic** (bukan cartoon/stylized)
   - Tekstur: **PBR** aktif, resolusi tertinggi yang ada (2K atau 4K)
   - Pose: **A-pose** (atau T-pose)
   - Topologi: **Quad** kalau ada; target polygon sekitar **30k**
   - Symmetry: aktif
3. Generate 3–4 kali, lalu pilih yang paling bagus (lihat **Cek kualitas** di bawah).
4. Download sebagai **GLB** (atau FBX) **lengkap dengan teksturnya**: base color, normal, roughness, metallic.
5. Taruh file-nya di folder ini (sudah aku buatkan), lalu kabari aku:

   ```
   MyOwnProject/blender/assets-src/character/raw/
   ```

   Di Finder: buka folder `MyOwnProject`, lalu `blender` → `assets-src` → `character` → `raw`.

### Prompt

```
Full-body 3D character, a tired young adult creator in their early twenties, realistic human proportions, standing in a relaxed A-pose with arms slightly away from the body, facing forward. Wearing a worn, faded charcoal hoodie with the hood down, slightly loose, frayed cuffs and drawstrings; dark straight-leg jeans with subtle wear at the knees; scuffed off-white low-top sneakers; large over-ear studio headphones on the head with a coiled cable. Short messy dark hair, pale tired face, neutral expression. Realistic PBR materials: cotton fleece, denim weave, rubber and canvas sneakers, matte plastic headphones. Even neutral lighting, no shadows baked into the textures, clean topology, symmetrical.
```

Kalau tools-nya punya kolom **negative prompt**:

```
cartoon, anime, stylized, low poly, chibi, exaggerated proportions, armor, weapon, fantasy, logo, text, baked lighting, harsh shadows, merged fingers, hands in pockets
```

Kalau mau karakter dengan gender tertentu, tambahkan saja di awal prompt (misalnya `young man` atau `young woman`). Defaultnya sengaja netral.

## Cek kualitas sebelum download

- Kedua tangan **terpisah dari badan**, dan jari-jarinya tidak menyatu jadi satu gumpalan.
- Hoodie, jeans, dan sepatu tidak meleleh jadi satu dengan kulit.
- Headphone utuh di kepala, tidak bolong.
- Tekstur tajam dan tidak buram. Tidak ada bayangan gelap yang "tercetak" di tekstur.
- Wajah tidak aneh. Sedikit jelek tidak apa-apa, karena wajahnya jarang kelihatan.

## Lisensi

Paket gratis tools AI 3D biasanya membuat hasilnya publik dan **wajib menyebut sumbernya** (sering CC BY 4.0). Catat tools dan paket yang kamu pakai. Nanti aku masukkan ke `CREDITS.md` supaya situsnya tetap legal.

## Setelah file-nya ada

1. **Aku** merapikan di Blender: skala, jumlah polygon, bake detail ke tekstur, memperbaiki tangan dan wajah, dan memisahkan headphone.
2. **Kamu** upload hasil rapian (FBX) ke **Mixamo** (mixamo.com) untuk auto-rig, lalu download daftar animasi yang aku kirim. Nama persisnya aku pilih setelah modelnya jadi.
3. **Aku** menggabungkan semua animasinya, membuat gerakan jatuh telentang, lalu memasang karakter di ruangan, saat jatuh, di pilar, di bab About, dan di bab Contact.
