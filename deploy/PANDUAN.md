# 🚀 Panduan Deploy Ultiland Bot Dashboard ke VPS

## Prasyarat

Sebelum mulai, pastikan kamu punya:
- VPS dengan Ubuntu 20.04 / 22.04 / 24.04
- Akses SSH ke VPS (sebagai root atau user dengan sudo)
- Kode sudah di-push ke GitHub

---

## Langkah 1 — Push kode ke GitHub

Di Replit, buka Shell dan jalankan:

```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

> Jika belum punya repo GitHub, buat dulu di [github.com/new](https://github.com/new)

---

## Langkah 2 — Login ke VPS

```bash
ssh root@IP_VPS_KAMU
```

---

## Langkah 3 — Download dan jalankan setup script

```bash
# Download script setup
curl -fsSL https://raw.githubusercontent.com/USERNAME/NAMA-REPO/main/deploy/setup.sh -o setup.sh

# Beri izin eksekusi
chmod +x setup.sh

# Jalankan!
sudo bash setup.sh
```

Script akan **otomatis**:
- ✅ Install Node.js 20, pnpm, PM2
- ✅ Install & konfigurasi PostgreSQL
- ✅ Buat database dan user
- ✅ Clone repository
- ✅ Install dependencies
- ✅ Buat tabel database
- ✅ Build frontend & backend
- ✅ Konfigurasi Nginx
- ✅ Jalankan server dengan PM2
- ✅ Pasang SSL gratis (jika pakai domain)

Script akan menanyakan beberapa input:
| Pertanyaan | Contoh |
|---|---|
| Path install | `/opt/ultiland-bot` |
| GitHub repo URL | `https://github.com/user/repo.git` |
| Domain / IP VPS | `123.45.67.89` atau `bot.domain.com` |
| Nama database | `ultiland` |
| Username database | `ultiland` |
| Password database | `password_kuat_kamu` |

---

## Langkah 4 — Akses dashboard

Setelah setup selesai, buka browser dan akses:

```
http://IP_VPS_KAMU
```
atau jika pakai domain:
```
https://domain-kamu.com
```

---

## Update ke versi terbaru

Setiap kali kamu update kode di Replit dan push ke GitHub, jalankan di VPS:

```bash
cd /opt/ultiland-bot
sudo bash deploy/update.sh
```

Script update akan otomatis pull kode terbaru, build ulang, dan restart server.

---

## Perintah berguna

```bash
# Cek status server
pm2 status

# Lihat log real-time server
pm2 logs ultiland-api

# Restart server manual
pm2 restart ultiland-api

# Stop server
pm2 stop ultiland-api

# Cek status Nginx
systemctl status nginx

# Reload Nginx setelah edit config
nginx -t && systemctl reload nginx

# Lihat log Nginx
tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

### Dashboard tidak bisa diakses
```bash
# Cek apakah Nginx berjalan
systemctl status nginx

# Cek apakah API server berjalan
pm2 status

# Cek port yang dipakai
ss -tlnp | grep '80\|3001'
```

### API error / data tidak muncul
```bash
# Lihat log API server
pm2 logs ultiland-api --lines 50

# Cek koneksi database
psql "$DATABASE_URL" -c "SELECT 1;"

# Cek file .env
cat /opt/ultiland-bot/.env
```

### Build gagal
```bash
# Pastikan versi Node.js benar
node -v   # harus v20.x

# Coba install ulang dependencies
cd /opt/ultiland-bot
pnpm install
```

### Port 80 sudah dipakai
```bash
# Cek siapa yang pakai port 80
ss -tlnp | grep ':80'

# Hentikan apache jika ada
systemctl stop apache2 && systemctl disable apache2
```

---

## Struktur file yang dibuat

```
/opt/ultiland-bot/
├── .env                          ← Environment variables (DATABASE_URL, etc.)
├── deploy/
│   ├── setup.sh                  ← Setup awal VPS
│   ├── update.sh                 ← Update ke versi terbaru
│   ├── ecosystem.config.cjs      ← Konfigurasi PM2
│   └── PANDUAN.md                ← File ini
├── artifacts/
│   ├── api-server/dist/          ← Backend (compiled)
│   └── ultiland-bot/dist/public/ ← Frontend (static files)
└── logs/
    ├── api-error.log             ← Log error server
    └── api-out.log               ← Log output server
```

---

## Keamanan (Opsional tapi disarankan)

### Ganti SSH port & nonaktifkan login password
```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Ubah:
# Port 2222        (ganti dari 22)
# PasswordAuthentication no

systemctl restart sshd
```

### Aktifkan firewall UFW
```bash
ufw allow 22      # atau port SSH baru kamu
ufw allow 80
ufw allow 443
ufw enable
```

### Akses dashboard dengan password (basic auth)
```bash
# Install htpasswd
apt-get install apache2-utils

# Buat user
htpasswd -c /etc/nginx/.htpasswd admin

# Tambahkan ke nginx config di block location /
# auth_basic "Ultiland Bot";
# auth_basic_user_file /etc/nginx/.htpasswd;

nginx -t && systemctl reload nginx
```
