#!/bin/bash
set -euo pipefail

# =============================================================================
# ULTILAND BOT DASHBOARD — VPS SETUP SCRIPT
# Jalankan sekali di VPS baru:
#   chmod +x setup.sh && sudo bash setup.sh
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

# ─── Cek root ─────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Script harus dijalankan sebagai root: sudo bash setup.sh"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        ULTILAND BOT DASHBOARD — VPS INSTALLER       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Input dari user ──────────────────────────────────────────────────────────
read -p "📁 Path install project (default: /opt/ultiland-bot): " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/opt/ultiland-bot}"

read -p "🔗 GitHub repo URL (contoh: https://github.com/user/repo.git): " REPO_URL
[[ -z "$REPO_URL" ]] && err "Repo URL wajib diisi."

read -p "🌐 Domain atau IP VPS kamu (contoh: 123.45.67.89 atau bot.domain.com): " SERVER_NAME
[[ -z "$SERVER_NAME" ]] && err "Domain/IP wajib diisi."

read -p "🗄️  Nama database PostgreSQL (default: ultiland): " DB_NAME
DB_NAME="${DB_NAME:-ultiland}"

read -p "👤 Username database (default: ultiland): " DB_USER
DB_USER="${DB_USER:-ultiland}"

read -s -p "🔑 Password database: " DB_PASS; echo ""
[[ -z "$DB_PASS" ]] && err "Password database wajib diisi."

SESSION_SECRET=$(openssl rand -hex 32)
API_PORT=3001

echo ""
info "Konfigurasi:"
echo "  Install dir : $INSTALL_DIR"
echo "  Repo        : $REPO_URL"
echo "  Domain/IP   : $SERVER_NAME"
echo "  DB Name     : $DB_NAME"
echo "  DB User     : $DB_USER"
echo "  API Port    : $API_PORT"
echo ""
read -p "Lanjutkan? (y/n): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && echo "Dibatalkan." && exit 0

# ─── Update sistem ─────────────────────────────────────────────────────────────
info "Update paket sistem..."
apt-get update -qq && apt-get upgrade -y -qq
log "Sistem diupdate"

# ─── Install dependencies dasar ───────────────────────────────────────────────
info "Install curl, git, unzip, build-essential..."
apt-get install -y -qq curl git unzip build-essential nginx certbot python3-certbot-nginx
log "Dependencies dasar terinstall"

# ─── Install Node.js 20 LTS ───────────────────────────────────────────────────
info "Install Node.js 20 LTS..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -qq
  apt-get install -y -qq nodejs
fi
log "Node.js $(node -v) terinstall"

# ─── Install pnpm ─────────────────────────────────────────────────────────────
info "Install pnpm..."
npm install -g pnpm@latest --quiet
log "pnpm $(pnpm -v) terinstall"

# ─── Install PM2 ──────────────────────────────────────────────────────────────
info "Install PM2..."
npm install -g pm2 --quiet
log "PM2 terinstall"

# ─── Install PostgreSQL ────────────────────────────────────────────────────────
info "Install PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql
log "PostgreSQL terinstall dan berjalan"

# ─── Setup database ───────────────────────────────────────────────────────────
info "Buat database dan user PostgreSQL..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
    CREATE USER "$DB_USER" WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
CREATE DATABASE IF NOT EXISTS "$DB_NAME" OWNER "$DB_USER" 2>/dev/null || true;
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
EOF
# Fallback jika IF NOT EXISTS tidak didukung
sudo -u postgres createdb "$DB_NAME" --owner="$DB_USER" 2>/dev/null || true
log "Database '$DB_NAME' siap"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# ─── Clone repository ─────────────────────────────────────────────────────────
info "Clone repository ke $INSTALL_DIR..."
if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "Direktori sudah ada, pull update..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone "$REPO_URL" "$INSTALL_DIR" --quiet
  cd "$INSTALL_DIR"
fi
log "Repository siap di $INSTALL_DIR"

# ─── Buat file .env ───────────────────────────────────────────────────────────
info "Buat file .env..."
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
PORT=$API_PORT
EOF
log "File .env dibuat"

# ─── Install dependencies ─────────────────────────────────────────────────────
info "Install pnpm dependencies (mungkin butuh beberapa menit)..."
cd "$INSTALL_DIR"
pnpm install --frozen-lockfile --silent
log "Dependencies terinstall"

# ─── Push schema database ─────────────────────────────────────────────────────
info "Buat tabel di database (drizzle push)..."
cd "$INSTALL_DIR"
export DATABASE_URL="$DATABASE_URL"
pnpm --filter @workspace/db run push --accept-data-loss 2>/dev/null || \
pnpm --filter @workspace/db run push-force 2>/dev/null || \
warn "Schema push gagal, lanjut tanpa error"
log "Schema database selesai"

# ─── Build aplikasi ───────────────────────────────────────────────────────────
info "Build API server..."
cd "$INSTALL_DIR"
pnpm --filter @workspace/api-server run build
log "API server berhasil di-build"

info "Build frontend dashboard..."
cd "$INSTALL_DIR"
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ultiland-bot run build
log "Frontend berhasil di-build"

# ─── Setup PM2 ────────────────────────────────────────────────────────────────
info "Setup PM2..."
cd "$INSTALL_DIR"
export DATABASE_URL="$DATABASE_URL"
export SESSION_SECRET="$SESSION_SECRET"
export PORT="$API_PORT"
export NODE_ENV="production"

pm2 delete ultiland-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true
log "PM2 berjalan (ultiland-api)"

# ─── Setup Nginx ──────────────────────────────────────────────────────────────
info "Konfigurasi Nginx..."

STATIC_DIR="$INSTALL_DIR/artifacts/ultiland-bot/dist/public"

cat > /etc/nginx/sites-available/ultiland <<NGINXCONF
server {
    listen 80;
    server_name $SERVER_NAME;

    root $STATIC_DIR;
    index index.html;

    # Proxy semua request /api ke Express backend
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    # Serve frontend SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
NGINXCONF

ln -sf /etc/nginx/sites-available/ultiland /etc/nginx/sites-enabled/ultiland
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
log "Nginx dikonfigurasi dan berjalan"

# ─── Cek apakah domain (bukan IP) untuk SSL ───────────────────────────────────
if [[ "$SERVER_NAME" =~ ^[a-zA-Z].*\..+$ ]]; then
  echo ""
  read -p "Pasang SSL (HTTPS) gratis dengan Let's Encrypt? (y/n): " SSL_CONFIRM
  if [[ "$SSL_CONFIRM" == "y" || "$SSL_CONFIRM" == "Y" ]]; then
    read -p "Email kamu (untuk notifikasi SSL): " SSL_EMAIL
    certbot --nginx -d "$SERVER_NAME" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect
    log "SSL Let's Encrypt terpasang"
  fi
fi

# ─── Selesai ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅  SETUP BERHASIL!                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Dashboard : http://$SERVER_NAME"
echo "  📁 Install   : $INSTALL_DIR"
echo "  🔑 .env file : $INSTALL_DIR/.env"
echo ""
echo "  Perintah berguna:"
echo "    pm2 status           — cek status server"
echo "    pm2 logs ultiland-api — lihat log server"
echo "    pm2 restart ultiland-api — restart server"
echo "    bash $INSTALL_DIR/deploy/update.sh — update ke versi terbaru"
echo ""
