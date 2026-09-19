# Aturan Keamanan & Pedoman Kerja AI (Antigravity)

## 1. Protokol Keamanan & Konfirmasi Pengguna
- **Penghapusan Berkas (File Deletion):**
  DILARANG KERAS menghapus file atau direktori yang sudah ada (menggunakan perintah terminal seperti `rm`, `del`, `Remove-Item`, ataupun pembersihan massal) tanpa meminta konfirmasi manual dan izin eksplisit dari pengguna.
- **Penghapusan Fungsi / Fitur (Function Deletion):**
  DILARANG KERAS menghapus, mematikan, atau merombak fungsi, fitur, atau logika bisnis yang sudah berjalan stabil tanpa izin eksplisit dari pengguna.
- **Modifikasi Kode:**
  Saat memperbaiki atau menambahkan fitur baru, jaga keutuhan fitur yang sudah berjalan lancar sebelumnya (prinsip regresi nol).

## 2. Eksekusi Otomatis (Tanpa Pop-up Konfirmasi)
- Perintah rutin seperti membaca file, membuat file baru, mengedit kode, menjalankan build (`npm run build`), instalasi dependensi, patch script, dan sinkronisasi Git (`commit` / `push`) harus dijalankan secara langsung dan efisien tanpa meminta konfirmasi berulang kali.
