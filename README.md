# Portofolio 3D "Analog Horror"

Website portofolio satu halaman yang digerakkan scroll. Pengunjung mengikuti seorang karakter yang jatuh ke dalam pikirannya sendiri, lalu kembali ke ruangan awal dalam loop tanpa ujung. Seluruh tampilannya bergaya kaset VHS terkutuk.

## Status

**Tahap 1 dari 8 (kerangka) selesai.** Yang sudah ada:
- Alur scroll lengkap, bisa maju-mundur, dan loop tanpa sambungan yang terlihat.
- Efek VHS dasar.
- Loader dengan kartu peringatan dan tombol ▶ PLAY.
- OSD ala kamera perekam dan menu.
- Teks tiap bab dengan efek diketik.

Semua bentuk 3D masih **blockout sementara** (kotak, kapsul, bola). Bentuk-bentuk ini akan diganti aset final mulai tahap 2 (karakter) dan tahap 3 (ruangan).

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

## Tes

```bash
npm test                          # unit test (Vitest)
npx playwright install chromium   # sekali saja, ±100 MB
npm run test:e2e                  # tes di browser (Playwright)
npm run typecheck && npm run lint
```

Tes `storyboard.spec.ts` menyimpan screenshot tiap bab ke `tests/e2e/__storyboard__/`. Folder ini tidak ikut masuk git.

## Deploy ke internet (Vercel)

Kamu cukup login sekali, lalu deploy dengan satu perintah:

```bash
npx vercel login
npx vercel --prod
```

`vercel login` akan membuka browser untuk login, misalnya dengan akun GitHub. Saat ditanya pengaturan proyek, pilih nilai default (Vercel mengenali Next.js secara otomatis). Hasil akhirnya berupa URL publik seperti `https://nama-proyek.vercel.app`.

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
```
