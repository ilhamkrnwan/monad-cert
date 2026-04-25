# 🚀 MonadCert — Frontend Implementation Plan

## 📌 Rekomendasi & Tech Stack Terpilih
Berdasarkan kebutuhan UI/UX yang premium (menggunakan `aceternity-ui` dan `shadcn/ui`), saya sangat merekomendasikan menggunakan **Next.js (App Router)** alih-alih Nuxt. Komunitas dan dukungan Aceternity UI serta Shadcn jauh lebih matang di ekosistem React/Next.js, yang mana akan mempercepat development fitur animasi dan UI kompleks.

**Tech Stack:**
- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS, Shadcn UI, Aceternity UI, Framer Motion (untuk micro-animations)
- **Web3:** Wagmi, Viem, RainbowKit (untuk Wallet Connect ke Monad Testnet)
- **Backend/DB:** Supabase Client (Auth, Database, Storage)

---

## 🗓️ Fase Implementasi (Berdasarkan Urgensi)

### Phase 1: Foundation & High-Conversion Landing Page (🔥 PALING URGENT)
**Tujuan:** Membangun fondasi frontend dan membuat halaman utama yang memukau untuk menarik institusi dan meyakinkan user.
- [ ] Inisialisasi Next.js, Tailwind CSS, dan komponen Shadcn dasar.
- [ ] Setup koneksi Supabase Client & konfigurasi Wagmi/RainbowKit untuk **Monad Testnet** (RPC: `https://testnet-rpc.monad.xyz`, Chain ID: 10143).
- [ ] **Landing Page UI (`/`):**
  - Implementasi Hero Section interaktif menggunakan *Aceternity UI* (misal: Aurora Background atau Spotlight) untuk menonjolkan kesan *Ultra-Fast* ("Parallel Execution" dari Monad) dan terpercaya.
  - Section fitur utama (Institutional Dashboard, Instant Verification, Hybrid Storage) dengan layout Bento Grid atau Card Hover effects.
  - Call-to-Action (CTA) interaktif.
- [ ] Implementasi *Dark Mode* by default dengan sentuhan glassmorphism.

### Phase 2: Public Verification Engine (`/verify`)
**Tujuan:** Fitur inti bagi pihak eksternal (HRD/Verifier) untuk memvalidasi sertifikat secara instan tanpa login.
- [ ] Halaman verifikasi dengan input search yang elegan.
- [ ] Integrasi Wagmi (read contract) untuk membaca ABI `EduTrust.sol` (`getCredential(tokenId)`).
- [ ] UI Hasil Verifikasi: Menampilkan status ✅ **Valid** (animasi centang sukses) beserta detail sertifikat, atau ❌ **Invalid** jika data tidak ditemukan/palsu.
- [ ] State handling saat transaksi blockchain sedang dimuat (Loading Skeleton).

### Phase 3: Institutional Dashboard & Minting Flow
**Tujuan:** Portal tertutup bagi institusi terdaftar untuk mengelola dan menerbitkan sertifikat (SBT).
- [ ] **Auth Flow:** Login via Connect Wallet -> Pengecekan on-chain `isApprovedInstitution` -> Redirect ke Dashboard.
- [ ] **Dashboard Layout:** Sidebar modern, tabel riwayat penerbitan menggunakan Shadcn Data Table.
- [ ] **Minting Form:**
  - Form data penerima (Nama, Wallet, Judul Sertifikat, dsb).
  - Logika pembentukan metadata JSON (ERC-721 standar).
  - Upload metadata ke **Supabase Storage** dan mendapatkan `tokenURI`.
- [ ] **Blockchain Write Transaction:**
  - Integrasi fungsi smart contract `issueCertificate` & `batchIssueCertificate`.
  - Handling transaksi (Pending, Confirming, Success) dengan Toast Notifikasi interaktif.

### Phase 4: User Profile & Admin Panel
**Tujuan:** Ekosistem tambahan untuk penerima sertifikat dan Provider Admin.
- [ ] **User Profile:** Halaman bagi user biasa untuk melihat daftar NFT/SBT sertifikat yang mereka miliki (Visualisasi sertifikat).
- [ ] **Admin Panel:** Halaman khusus Owner/Super Admin untuk mereview pendaftaran institusi (Approve via fungsi `grantInstitution` atau Reject via `revokeInstitution`).

---

## ❓ Pertanyaan & Klarifikasi (Mohon Review)
Sebelum saya mulai mengeksekusi **Phase 1 (Inisialisasi & Landing Page)**, ada beberapa hal yang butuh konfirmasi Anda:

1. **Framework (Penting):** Apakah Anda setuju kita menggunakan **Next.js**? Di `README.md` disebutkan *Nuxt 4*, namun di dokumen konteks Anda meminta `aceternity-ui` dan `shadcn` yang mana merupakan library bawaan React. Menggunakan Next.js akan menghasilkan UI yang jauh lebih maksimal.
2. **Desain Visual:** Apakah ada palet warna spesifik? Jika tidak, saya akan menggunakan skema *Dark Mode* premium dengan aksen *Neon/Monad Purple* khas Web3.
3. **Wallet Connect:** Apakah Anda ada preferensi untuk UI koneksi wallet? Saya merekomendasikan **RainbowKit** karena UI-nya sangat elegan dan mudah di-custom.
4. **Status Smart Contract:** Apakah kontrak `EduTrust.sol` sudah dideploy ke Monad Testnet, atau sementara saya gunakan *dummy address* untuk mem-build UI terlebih dahulu?

Silakan review plan ini. Jika Anda memberikan lampu hijau (*Approved*), saya akan segera menginisialisasi project dan mendesain Landing Page se-maksimal mungkin!
