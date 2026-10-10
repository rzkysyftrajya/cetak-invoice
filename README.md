# Carrental Invoice Pro

PROJECT: VICKY RENTAL NUSANTARA — INVOICE GENERATOR

Buat sebuah website profesional untuk membuat, mengelola, menyimpan, dan mencetak invoice PDF untuk perusahaan rental mobil.

Website ini akan digunakan oleh tim administrasi PT Vicky Rental Nusantara untuk membuat invoice tagihan kepada klien perusahaan, travel agent, vendor, dan pelanggan rental mobil.

1. REFERENSI DESAIN WAJIB

Gunakan file PDF invoice yang saya upload sebagai referensi utama desain dan struktur dokumen.

Pertahankan karakteristik invoice asli, meliputi:

- Identitas perusahaan di bagian atas.
- Logo perusahaan.
- Informasi alamat, telepon/WhatsApp, dan email perusahaan.
- Informasi penerima invoice.
- Nomor invoice dan tanggal penerbitan.
- Tabel rincian kendaraan dan layanan.
- Grand total.
- Informasi rekening bank.
- Bagian tanda tangan direktur.
- Ucapan terima kasih di bagian bawah.

Jangan membuat desain invoice yang terlalu berbeda dari dokumen referensi. Tingkatkan kerapian, konsistensi jarak, alignment, tipografi, dan profesionalitas tanpa menghilangkan karakter invoice aslinya.

Gunakan logo dan gambar tanda tangan dari aset yang disediakan jika tersedia. Jangan membuat logo atau tanda tangan palsu. Jika aset belum tersedia secara terpisah, sediakan fitur untuk mengunggahnya.

2. IDENTITAS PERUSAHAAN

Gunakan informasi berikut sebagai nilai awal yang bisa diedit melalui pengaturan perusahaan.

Nama perusahaan:
PT VICKY RENTAL NUSANTARA

Alamat:
Jl. Sempurna Gg. Mawar No.12, Dusun II, Sambirejo Timur, Kec. Medan Tembung, Kabupaten Deli Serdang, Sumatera Utara 20371.

Telepon/WhatsApp:
082363389893

Email:
vickeycky@gmail.com

Bank transfer:

BCA
Nama rekening: VICKY
Nomor rekening: 3831944879

MANDIRI
Nama rekening: VICKY
Nomor rekening: 1060017903132

BNI
Nama rekening: VICKY
Nomor rekening: 0793804826

Jabatan penandatangan:
Direktur

Nama penandatangan:
VICKY

Semua informasi perusahaan, rekening bank, dan penandatangan harus dapat diubah dari halaman pengaturan. Jangan mengubah informasi tersebut secara otomatis.

3. DASHBOARD ADMIN

Buat dashboard modern, sederhana, responsif, dan mudah digunakan oleh staf administrasi nonteknis.

Sidebar navigasi:

- Dashboard
- Buat Invoice
- Riwayat Invoice
- Data Klien
- Data Kendaraan
- Pengaturan Perusahaan

Dashboard menampilkan:

- Total invoice.
- Total nominal invoice.
- Jumlah invoice bulan ini.
- Invoice terbaru.
- Tombol cepat "Buat Invoice".

Gunakan bahasa Indonesia untuk semua label, tombol, validasi, dan notifikasi.

4. FORM BUAT INVOICE

Buat form invoice dengan bagian berikut.

A. Informasi invoice

- Nomor invoice.
- Tanggal invoice.
- Kota penerbitan invoice.
- Nama perusahaan atau klien.
- Nama PIC atau penerima invoice.
- Alamat klien, opsional.
- Catatan tambahan, opsional.

Nomor invoice dibuat otomatis, unik, dan tidak boleh duplikat. Gunakan sistem penomoran yang konsisten dan aman terhadap pembuatan invoice bersamaan.

Pengguna juga dapat mengedit nomor invoice secara manual dengan validasi duplikasi.

B. Rincian layanan rental mobil

Sediakan tabel yang dapat menambahkan dan menghapus beberapa baris kendaraan dalam satu invoice.

Setiap baris berisi:

- Nomor urut.
- Jenis mobil.
- Nomor polisi.
- Tanggal layanan.
- Rute perjalanan.
- Tipe layanan, misalnya Dengan Driver atau Lepas Kunci.
- Jumlah hari.
- Harga per hari.
- Total harga.

Rumus:
Total per baris = Jumlah hari × Harga per hari.

Grand Total = Penjumlahan semua total baris.

Pastikan seluruh perhitungan dilakukan secara otomatis dan akurat. Format mata uang menggunakan Rupiah Indonesia, misalnya Rp1.350.000.

Jumlah hari harus berupa bilangan positif. Validasi harga dan seluruh input agar tidak menghasilkan nilai negatif atau perhitungan yang salah.

C. Preview invoice

Sediakan preview invoice secara langsung saat pengguna mengisi form.

Preview harus menyerupai hasil PDF yang akan dihasilkan, bukan sekadar menampilkan data mentah.

Tombol tindakan:

- Preview Invoice
- Simpan Invoice
- Download PDF
- Cetak Invoice
- Reset Form

Sebelum reset, minta konfirmasi jika terdapat data yang sudah diisi.

5. OUTPUT PDF — FITUR PALING PENTING

Fitur PDF wajib benar-benar berfungsi.

Gunakan library PDF yang sesuai, seperti @react-pdf/renderer atau solusi setara yang kompatibel dengan stack proyek.

Spesifikasi PDF:

- Ukuran kertas A4 portrait.
- Dokumen satu halaman jika konten masih muat.
- Jika terdapat banyak kendaraan, buat halaman lanjutan secara otomatis.
- Header perusahaan tampil konsisten.
- Logo tampil dengan proporsi yang benar.
- Tabel kendaraan rapi dan tidak terpotong.
- Grand total mudah ditemukan.
- Informasi rekening bank tampil di bagian bawah.
- Area tanda tangan direktur tampil sesuai referensi.
- Gunakan aset tanda tangan asli yang diberikan.
- Footer menampilkan ucapan "Terima Kasih!".
- Format angka dan tanggal konsisten.
- Tidak boleh ada teks bertumpuk, terpotong, keluar dari margin, atau tabel yang rusak.

Nama file PDF menggunakan format yang mudah dikenali, misalnya:
Invoice-15905-AstrindoTravel.pdf

Bersihkan karakter ilegal pada nama file secara otomatis.

PDF harus bisa diunduh, dibuka, dan dicetak. Jangan hanya membuat tombol yang terlihat aktif tanpa implementasi fungsi.

6. RIWAYAT DAN PENGELOLAAN INVOICE

Pengguna dapat:

- Melihat semua invoice yang tersimpan.
- Mencari berdasarkan nomor invoice atau nama klien.
- Memfilter berdasarkan rentang tanggal.
- Membuka detail invoice.
- Mengunduh kembali PDF.
- Mengedit invoice yang sudah disimpan.
- Menghapus invoice dengan konfirmasi.
- Menyalin invoice lama menjadi invoice baru.

Saat mengedit atau membuka kembali invoice, seluruh detail kendaraan, harga, klien, tanggal, dan total harus tetap sesuai data yang tersimpan.

Invoice baru hasil duplikasi harus memiliki nomor invoice baru dan tidak boleh menimpa invoice lama.

Sediakan status invoice:

- Draft
- Final

Invoice final harus memiliki nomor unik yang tidak berubah hanya karena halaman di-refresh.

7. DATA KLIEN DAN KENDARAAN

Buat modul data klien agar pengguna dapat menyimpan:

- Nama perusahaan.
- Nama PIC.
- Nomor telepon.
- Email.
- Alamat.

Buat modul data kendaraan untuk menyimpan:

- Jenis mobil.
- Nomor polisi.
- Harga default per hari, opsional.

Ketika membuat invoice, pengguna dapat memilih klien atau kendaraan yang tersimpan. Data tetap dapat disesuaikan untuk transaksi tertentu tanpa mengubah data master secara tidak sengaja.

8. BACKEND DAN DATABASE

Gunakan Supabase untuk penyimpanan data permanen.

Rancang tabel yang terstruktur, minimal:

- profiles atau users.
- company_settings.
- clients.
- vehicles.
- invoices.
- invoice_items.

Relasi antar-tabel harus benar. Gunakan primary key, foreign key, timestamps, serta aturan integritas data yang sesuai.

Simpan rincian invoice sebagai data terstruktur di database. PDF dapat dibuat dari data tersimpan ketika dibutuhkan.

Jika aset logo dan tanda tangan disimpan di Supabase Storage, gunakan akses yang sesuai dan jangan membuat bucket publik untuk data sensitif tanpa alasan yang jelas.

9. LOGIN DAN KEAMANAN

Website ini merupakan aplikasi internal perusahaan.

Implementasikan autentikasi admin menggunakan Supabase Auth.

Ketentuan:

- Halaman dashboard hanya dapat diakses pengguna yang sudah login.
- Data invoice tidak boleh dapat dibaca atau diubah oleh pengguna anonim.
- Terapkan Row Level Security (RLS) pada seluruh tabel yang menyimpan data internal.
- Jangan menaruh service role key di frontend.
- Jangan menonaktifkan RLS demi mempermudah implementasi.
- Batasi akses sesuai peran pengguna.
- Tampilkan pesan error yang jelas tanpa membocorkan kredensial atau detail internal.

Jangan mengarang konfigurasi Supabase. Jika kredensial belum tersedia, siapkan struktur integrasi dan tampilkan petunjuk konfigurasi.

10. DESAIN UI/UX

Gunakan gaya dashboard SaaS yang profesional:

- Warna utama biru tua dan putih.
- Background abu-abu sangat muda.
- Kartu statistik yang sederhana.
- Tabel dengan spacing yang nyaman.
- Form dengan label yang jelas.
- Tombol utama yang konsisten.
- Sidebar desktop dan navigasi responsif pada perangkat mobile.
- Loading state, empty state, error state, dan notifikasi sukses.
- Format Rupiah otomatis pada kolom harga.
- Layout yang nyaman digunakan melalui laptop maupun HP.

Hindari animasi berlebihan, dekorasi yang tidak diperlukan, dan desain yang mengganggu pekerjaan administrasi.

11. KETENTUAN IMPLEMENTASI

Jangan hanya membuat mockup frontend.

Implementasikan alur utama secara nyata:

1. Admin login.
2. Admin membuka form invoice.
3. Admin mengisi data klien dan kendaraan.
4. Sistem menghitung total.
5. Admin melihat preview.
6. Admin menyimpan invoice.
7. Data tersimpan di database.
8. Admin mengunduh PDF.
9. Invoice dapat dibuka kembali melalui riwayat.

Buat kode yang modular, mudah dirawat, dan memiliki penanganan error yang baik.

Gunakan TypeScript dan validasi data pada frontend maupun backend.

Jangan mengklaim fitur sudah terhubung jika integrasi backend belum selesai.

12. KRITERIA SELESAI

Sebelum menyatakan proyek selesai, pastikan:

- Login berfungsi.
- Form invoice berfungsi.
- Perhitungan harga benar.
- Nomor invoice tidak duplikat.
- Data tersimpan di Supabase.
- Riwayat invoice berfungsi.
- Preview sesuai dengan PDF.
- Download PDF menghasilkan file valid.
- Logo dan tanda tangan tampil jika aset tersedia.
- Invoice multi-item dapat dicetak tanpa layout rusak.
- Layout responsif di HP dan desktop.
- RLS dan autentikasi sudah dikonfigurasi dengan benar.

Mulai dengan membaca referensi PDF yang saya berikan, kemudian bangun aplikasi berdasarkan spesifikasi ini. Prioritaskan akurasi invoice dan keberhasilan menghasilkan PDF dibandingkan dekorasi UI.

This project was built with [Lovable](https://lovable.dev).

## Menghubungkan aplikasi ke Supabase

1. Pastikan variabel `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, dan `SUPABASE_PUBLISHABLE_KEY` sudah diatur pada environment proyek. Jangan bagikan atau commit file `.env`.
2. Jalankan migrasi `drizzle/migrations/0000_migration.sql` dan `drizzle/migrations/0001_migration.sql` pada proyek Supabase yang sama.
3. Buka aplikasi dan pilih **Daftar sebagai admin pertama** untuk akun admin awal. Jika autentikasi Supabase mewajibkan verifikasi email, verifikasi email lalu masuk.
4. Di perangkat lain, buka alamat aplikasi yang sudah di-deploy dan masuk menggunakan akun yang sama. Invoice, klien, kendaraan, dan pengaturan perusahaan yang disimpan dari aplikasi akan dibaca dari Supabase.
5. Invoice lama yang hanya tersimpan di browser tidak otomatis berpindah. Pada browser asal, masuk ke aplikasi dan pilih **Impor invoice lokal**. Data browser lama tidak dihapus; nomor invoice yang sudah ada di Supabase tidak dibuat ulang.

Akun lain harus dibuat melalui Supabase Auth, lalu diberi peran `staff` oleh admin melalui SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'staff' from auth.users where email = '<EMAIL_AKUN>';
```

Jalankan perintah tersebut setelah mengganti `<EMAIL_AKUN>` dengan email akun yang sesuai. Jangan menaruh service-role key di browser atau environment `VITE_*`.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dcb5e079-d75a-4595-96b6-9422ee9aecef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
