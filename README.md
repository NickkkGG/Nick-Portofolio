# Portofolio 3D "Analog Horror"

Website portofolio satu halaman yang digerakkan scroll. Pengunjung mengikuti seorang karakter yang jatuh ke dalam pikirannya sendiri, lalu kembali ke ruangan awal dalam loop tanpa ujung. Seluruh tampilannya bergaya kaset VHS terkutuk.

## Status

**Tahap 1 dari 8 (kerangka) selesai.** Yang sudah ada:
- Alur scroll lengkap, bisa maju-mundur, dan loop tanpa sambungan yang terlihat.
- Efek VHS dasar.
- Loader dengan kartu peringatan dan tombol ▶ PLAY.
- OSD ala kamera perekam dan menu.
- Teks tiap bab dengan efek diketik.

**Tahap 3 (ruangan final) selesai.** Ruangan pembuka memakai aset Blender asli:
- Dinding plester mengelupas dengan noda lembap, lantai beton, meja kayu, kursi kulit, monitor CRT, lampu meja dengan bohlam telanjang, jendela besi dengan kerai, radiator, rak berisi buku bersampul dan berjudul, lemari, PC, kabel, poster, dan jaring laba-laba.
- Tekstur PBR berlisensi CC0, dengan cahaya yang di-bake di Blender (bulan, lampu, dan layar terpisah, jadi lampu bisa berkedip live).
- Lampu yang berkedip, maksimal 3 kali per detik.
- Monitor yang mengetik source code website ini sendiri.
- Ketukan hantu: klik dinding untuk mengetuk. Ada suaranya, debu dan serpihan cat berjatuhan, lalu lampu berkedip. Ketukan kelima membuat monitor bertanya "who's there?".

**Dunia di bawah ruangan sedang direview.** Semua bab setelah ruangan sekarang memakai aset Blender asli:
- **Jatuh:** bongkahan lantai beton (lengkap dengan besi beton) berjatuhan, lampu kamar bersinar dari lubang di atas.
- **Work:** pilar kabel basah yang terpilin, dengan keyboard, radio, dan TV terjepit di dalamnya. Enam CRT raksasa tergantung (layar statis + judul project), 42 monitor redup di kejauhan, pilar-pilar kabel lain, kabel yang menjuntai, menara TV, dan berkas cahaya.
- **Dasar (About, Stack, Contact):** lantai beton tergenang air tipis yang memantulkan semuanya (pantulan asli, plus riak dari tetesan air), reruntuhan, TV tenggelam yang layarnya masih menyala, dan bohlam besar di kabel 6 m.
- **About:** sepuluh "problem" merah (jendela error yang glitch, rambu peringatan, pecahan) mengitari karakter yang duduk di atas TV mati, lalu berubah jadi keycap begitu bohlam menyala.
- **Stack:** keycap bertuliskan nama tool mengitari bohlam. Arahkan kursor ke salah satunya untuk menekannya.
- **Contact:** empat kaset VHS dalam sampul karton naik dari air. Arahkan kursor untuk menarik kasetnya keluar, klik untuk membuka link.
- **Loop:** atap beton dengan retakan yang menyala oleh lampu kamar di bawahnya.
- **Scroll** lebih berat dan halus, dan kamera meluncur tanpa berhenti di setiap titik.
- **Transisi antar bab** lewat "kaca tabung CRT": gambar membesar di tengah, warnanya terpecah di pinggir, ada noda sidik jari di kaca, dan riak pelangi seperti TV lama yang di-degauss.

Karakter (tahap 2) masih kapsul sementara. Cara membangun ulang semua aset ada di [`blender/README.md`](blender/README.md).

## Menjalankan di komputer

```bash
npm install
npm run dev
```

Lalu buka http://localhost:3000.

| Alamat | Isi |
|---|---|
| `/` | Website biasa |
| `/?debug` | Website + panel debug (lompat ke bab, bekukan waktu, kekuatan VHS) + penghitung FPS |
| `/?debug&quiet` | Hanya hook `window.__experience`, dipakai tes otomatis |

## Kontrol

- **Scroll mouse atau trackpad:** maju dan mundur di cerita. Setelah bab kontak, cerita kembali ke ruangan, dan hitungan loop bertambah.
- **Space / PageDown / panah bawah** untuk maju, **Shift+Space / PageUp / panah atas** untuk mundur.
- **Home atau Cmd+↑** kembali ke awal ruangan.
- **Menu WORK · ABOUT · CONTACT** melompat ke awal bab terkait.
- **Klik kiri di dinding ruangan** (kursor berubah jadi kepalan tangan) untuk mengetuk. Ketukan hanya bisa di awal bab ruangan, sebelum lantainya mulai amblas.
- **Arahkan kursor ke keycap** di bab Stack untuk menekannya, dan **ke kaset** di bab Contact untuk menariknya keluar. **Klik kaset** untuk membuka link-nya.

## Tes

```bash
npm test                          # unit test (Vitest)
npx playwright install chromium   # sekali saja, ±100 MB
npm run test:e2e                  # tes di browser (Playwright)
npm run typecheck && npm run lint
```

Tes `storyboard.spec.ts` menyimpan screenshot tiap bab ke `tests/e2e/__storyboard__/`. Folder ini tidak ikut masuk git.

## Deploy ke internet (Vercel)

Situsnya live di https://nick-project-1.vercel.app (project Vercel `nick-project-1`).

Kamu cukup login sekali, lalu deploy ke project itu dengan satu perintah:

```bash
npx vercel login
npx vercel deploy --prod --project nick-project-1
```

`vercel login` akan membuka browser untuk login, misalnya dengan akun GitHub. Opsi `--project` jangan dihapus: folder ini tidak di-link ke Vercel, jadi tanpa opsi itu Vercel akan menawarkan bikin project baru, dan situs yang sudah live tidak ikut ter-update.

Alternatifnya: push repo ini ke GitHub, lalu import di https://vercel.com/new. Setelah itu, setiap `git push` akan deploy otomatis.

## Menambah project

1. Buka `src/content/projects.ts`.
2. Ubah salah satu entri menjadi `status: 'live'`, lalu isi `summary`, `media` (misalnya `/projects/nama-project/cover.jpg`), dan opsional `year`, `role`, `tags`, `link`.
3. Taruh file medianya di `public/projects/nama-project/`.

Kalau ada isian yang salah, `npm run build` akan gagal dengan pesan yang menyebutkan field-nya. Data lain (nama, about, stack, kontak) ada di `src/content/`.

## Struktur singkat

```
src/
  app/          halaman Next.js
  content/      data website + validasi
  timeline/     scroll → bab (logika murni, ada tesnya)
  scroll/       Lenis mode infinite
  store/        state global (Zustand)
  experience/   dunia 3D: kamera, blockout per bab, efek VHS
  ui/           loader, OSD, menu, teks bab
  debug/        mode debug dan hook tes
tests/e2e/      tes Playwright
blender/        script Blender untuk semua aset 3D (lihat blender/README.md)
public/models/  hasil ekspor: room.glb dan lightmap-nya
```
