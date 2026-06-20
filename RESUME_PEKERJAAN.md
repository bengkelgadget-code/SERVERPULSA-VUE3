# Resume Pekerjaan — Server Pulsa

> Ringkasan lengkap seluruh perbaikan, fitur baru, dan konfigurasi yang telah dikerjakan pada proyek **Server Pulsa** (Vue 3 + Capacitor + Supabase).

---

## Daftar Isi

1. [Audit & Perbaikan Kritis (Fase 1–3)](#1-audit--perbaikan-kritis)
2. [Integritas Saldo & Transaksi Backend](#2-integritas-saldo--transaksi-backend)
3. [Cetak & Berbagi Nota (ReceiptView)](#3-cetak--berbagi-nota)
4. [Notifikasi Status Transaksi](#4-notifikasi-status-transaksi)
5. [Build Android & CI/CD](#5-build-android--cicd)
6. [OTA Updates (Capgo)](#6-ota-updates-capgo)
7. [Lain-lain](#7-lain-lain)

---

## 1. Audit & Perbaikan Kritis

Berdasarkan audit menyeluruh dari `implementation_plan.md`, berikut perbaikan yang telah diimplementasikan:

### Fase 1 — KRITIS ✅

| Bug | File | Deskripsi Perbaikan |
|-----|------|---------------------|
| **Halaman transaksi admin kosong** | `AllTransactions.vue` | Kolom harga salah (`trx.price` → `trx.harga_jual`, `trx.original_price` → `trx.harga_modal`) |
| **Filter status tidak berfungsi** | `GlobalTransactions.vue` | Opsi filter `"Sukses"/"Gagal"` (kapital) → `"sukses"/"gagal"` (sesuai DB) |
| **Double-submit (saldo terpotong 2x)** | `TransactionView.vue` | Tambah `isSubmitting` ref yang dikunci SEBELUM dialog konfirmasi |
| **Regex nomor HP rusak** | `useContacts.ts` | `\\D` (literal) → `\D` (regex non-digit). Nomor kontak kini bersih |
| **Tidak ada validasi nomor HP** | `TransactionView.vue`, `CategoryInputView.vue`, `EwalletInputView.vue` | Fungsi `validatePhone()` — tolak non-angka, terlalu pendek, prefix salah (harus 08xx, 10-13 digit) |

### Fase 2 — TINGGI ✅

| Bug | File | Deskripsi Perbaikan |
|-----|------|---------------------|
| **Reject deposit race condition** | `SystemDeposits.vue` | Tambah `.eq('status', 'pending')` — reject hanya jika masih pending |
| **Dashboard overfetching** | `dashboard_optimization.sql` | SQL RPC `get_profit_summary()` & `get_deposit_summary()` — agregasi server-side |
| **Bluetooth state terisolasi** | `useBluetooth.ts` | Singleton pattern — state `devices`, `connectedDevice`, dll dipindah ke module-level |
| **`isConnected` diset sebelum connect** | `ReceiptView.vue` | `printerStore.isConnected = true` dipindah SETELAH `bluetooth.connect()` berhasil |
| **Polling boros baterai** | `TransactionPopup.vue` | Interval 5s → 15s. API call hanya jika ada pending. Cek 1 per siklus, bukan 3 |

### Fase 3 — SEDANG ✅

| # | File | Deskripsi Perbaikan |
|---|------|---------------------|
| **#17** Cek saldo sebelum beli | `TransactionView.vue` | Validasi: jika saldo < total, tampilkan "Saldo tidak cukup" |
| **#18** Footer PLN di semua struk | `ReceiptView.vue` | "Call Center 123" & "PLN Terdekat" hanya muncul `v-if="isPln"` (HTML + canvas) |

---

## 2. Integritas Saldo & Transaksi Backend

### Double Refund / Race Condition
- **Root cause:** Multiple code path (webhook + purchase handler + check-status) bisa refund transaksi yang sama secara bersamaan
- **Fix:** Ganti semua `add_balance` refund manual dengan `refund_purchase` RPC yang menggunakan `SELECT ... FOR UPDATE` + flag `is_refunded`
- **File:** `supabase/functions/api/index.ts` (5 lokasi refund)

### Idempotent RPCs (balance_integrity_patch.sql)
- `approve_deposit` — idempotent, cek status sebelum approve
- `refund_purchase` — `FOR UPDATE` lock + `is_refunded` guard
- `add_balance` — cegah saldo negatif
- `process_purchase` — cek duplikat `ref_id`, lock row user
- `transfer_balance` — validasi saldo cukup

### Status Transaksi
- Digiflazz status parsing menggunakan `.includes()` untuk robust matching ("Transaksi Gagal" → "gagal")
- Error handler di `catch` block menandai transaksi sebagai `gagal` + refund (tidak stuck `pending`)

---

## 3. Cetak & Berbagi Nota (ReceiptView)

### Perbaikan Layout
- Nota di tengah halaman (hapus `pb-20`)
- REFF panjang di-truncate dengan `...` (30 karakter di template, 35 di canvas)
- SN/REF diparse menjadi baris terpisah (NAMA, SN, REFF)
- Nama toko dinamis dari `auth.userProfile.nama_toko` (bukan hardcoded "BENGKEL GADGET")

### Cetak Bluetooth
- Format receipt Bluetooth disamakan persis dengan layout canvas review
- Auto-reconnect printer saat app startup dan resume dari background
- Fallback ke canvas share jika tidak ada printer Bluetooth

### Berbagi Nota
- Share menggunakan `Share.share({ files: [uri] })` (bukan `url`) untuk kompatibilitas Android FileProvider
- Support format JPG dan PDF via `shareReceipt()`
- Modal pilihan format (JPG/PDF) dengan UI centered

### Native Android Print (PrintBridge)
- Custom Capacitor plugin `PrintBridge.java` menggunakan Android `PrintManager` API
- Cetak langsung tanpa aplikasi pihak ketiga (RawBT, dll)
- PDF di-render dari canvas bitmap, diskalakan ke ukuran kertas thermal 80mm

---

## 4. Notifikasi Status Transaksi

### Realtime + Polling Fallback
- Komponen `TransactionPopup.vue` listen perubahan tabel `transactions` via Supabase Realtime
- Filter client-side: hanya transaksi milik user (sebagai `user_id` ATAU `staff_id`)
- **Polling fallback** setiap 15 detik — fetch pending → cek status via API → show popup jika berubah
- `knownPendingIds` Set melacak transaksi pending yang belum selesai
- Local notifications (native Android) untuk notifikasi background

### History View
- Realtime subscription diperbaiki untuk include staff transactions
- Status `gagal` langsung muncul di history tanpa perlu refresh

---

## 5. Build Android & CI/CD

### Release APK Signing
- Generate `release.keystore` (RSA 2048-bit, 10000 hari)
- Alias: `serverpulsa`, Password: `serverpulsa2026`
- APK ditandatangani dengan v2 APK Signature Scheme
- **Asus ROG** yang menolak debug-signed APK kini bisa install

### GitHub Actions Workflow
- Build release APK (`assembleRelease`) dengan keystore dari repo
- Upload APK ke GitHub Releases sebagai artifact
- Trigger otomatis pada push ke `main`

### Konfigurasi Build
- `compileSdkVersion = 36` (wajib untuk Capacitor 8)
- `targetSdkVersion = 33` (kompatibilitas sideloading Android 14)
- `minSdkVersion = 24`
- Package name: `com.serverpulsa.pro`

### Environment Build Lokal
- JDK 21 portable (Temurin) di `.jdk-temp/` — workaround untuk Android Studio JBR yang corrupt
- `local.properties` dengan path Android SDK
- `.jdk-temp` di-gitignore

---

## 6. OTA Updates (Capgo)

- Capgo Capacitor Updater (`@capgo/capacitor-updater`) terpasang
- `npm run build` otomatis generate `update.zip` + `version.json` di folder `dist/`
- Update dikirim ke app yang sudah terinstall tanpa rebuild APK
- Tidak perlu `npx cap sync` atau build APK baru untuk perubahan frontend

---

## 7. Lain-lain

### UI/UX
- Logo dan splash screen app diperbarui
- Bottom navigation konsisten di semua halaman
- Pull-to-refresh di halaman utama
- Format Rupiah konsisten (`formatRp` utility)

### Superadmin Dashboard
- Profit calculation diperbaiki (server-side aggregation)
- Realtime subscription untuk auto-refresh stats
- Saldo Digiflazz, Total Saldo Mitra, dan Total Profit tampil real-time

### Keamanan
- RLS policies: staff hanya melihat transaksi admin-nya
- `get-admin-balance` endpoint: staff bisa lihat saldo admin via service role
- Deposit rejection dengan race condition protection

### File SQL Migration
| File | Deskripsi |
|------|-----------|
| `balance_integrity_patch.sql` | Idempotent RPCs (approve, refund, add_balance, process_purchase, transfer) |
| `security_patch.sql` | `is_refunded` column, RLS mitra_pricing |
| `dashboard_optimization.sql` | `get_profit_summary()` dan `get_deposit_summary()` server-side RPCs |
| `rls_transactions_fix.sql` | Helper functions `get_admin_id()`, `is_superadmin()`, unified RLS policy |
| `staff_rls_patch.sql` | Staff RLS untuk lihat transaksi mereka |
| `superadmin_rls.sql` | Superadmin RLS policies |
| `mitra_pricing_migration.sql` | Tabel `mitra_pricing` dengan RLS |

---

## File yang Berubah (Uncommitted)

```
 M src/components/TransactionPopup.vue
 M src/composables/useBluetooth.ts
 M src/composables/useContacts.ts
 M src/views/CategoryInputView.vue
 M src/views/EwalletInputView.vue
 M src/views/ReceiptView.vue
 M src/views/TransactionView.vue
 M src/views/admin/AllTransactions.vue
 M src/views/superadmin/GlobalTransactions.vue
 M src/views/superadmin/SystemDeposits.vue
?? supabase/dashboard_optimization.sql
```

**Total:** 10 file modified, 1 file baru (+85 lines, -29 lines)

---

## Status Deploy

| Komponen | Status |
|----------|--------|
| Frontend (Vue) | ✅ Perlu commit & push → Capgo OTA auto-update |
| Backend (Supabase Edge Functions) | ✅ Perlu deploy: `npx supabase functions deploy api` |
| SQL Migrations | ⏳ Perlu manual apply di Supabase Dashboard SQL Editor |
| Android APK | ✅ Release APK sudah built & signed |
