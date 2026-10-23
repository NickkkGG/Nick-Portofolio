# Nick Portofolio

Portofolio 3D satu halaman yang digerakkan scroll. Masih terus dikembangkan, tapi versi terbarunya sudah live di:

**https://nick-project-1.vercel.app**

Pengunjung mengikuti seorang karakter yang jatuh dari kamarnya ke dunia di bawah lantai, melewati project, cerita, tools, dan kontak, lalu kembali ke kamar dalam loop tanpa ujung. Semuanya terlihat seperti rekaman kaset VHS lama. Paling enak dibuka di laptop atau PC, pakai headphone.

Dibangun dengan Next.js, React Three Fiber, Three.js, dan efek postprocessing buatan sendiri. Semua aset 3D dibuat lewat script Python di Blender (lihat [`blender/README.md`](blender/README.md)).

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
