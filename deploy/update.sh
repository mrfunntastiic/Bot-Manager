#!/bin/bash
set -euo pipefail

# =============================================================================
# ULTILAND BOT — UPDATE SCRIPT
# Jalankan untuk update ke versi terbaru dari GitHub:
#   sudo bash deploy/update.sh
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         ULTILAND BOT DASHBOARD — UPDATE             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Load .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a && source "$PROJECT_DIR/.env" && set +a
  log ".env dimuat"
else
  warn "File .env tidak ditemukan di $PROJECT_DIR/.env"
fi

cd "$PROJECT_DIR"

# ─── Pull kode terbaru ────────────────────────────────────────────────────────
info "Pull kode terbaru dari Git..."
git pull --quiet
log "Kode diupdate"

# ─── Install/update dependencies ──────────────────────────────────────────────
info "Update dependencies..."
pnpm install --frozen-lockfile --silent
log "Dependencies diupdate"

# ─── Push schema database (jika ada perubahan) ────────────────────────────────
info "Sync schema database..."
pnpm --filter @workspace/db run push --accept-data-loss 2>/dev/null || \
warn "Schema push dilewati (tidak ada perubahan atau gagal)"

# ─── Build ulang ──────────────────────────────────────────────────────────────
info "Build API server..."
pnpm --filter @workspace/api-server run build
log "API server di-build ulang"

info "Build frontend..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ultiland-bot run build
log "Frontend di-build ulang"

# ─── Restart PM2 ─────────────────────────────────────────────────────────────
info "Restart server (PM2)..."
pm2 restart ultiland-api --update-env
log "Server di-restart"

# ─── Reload Nginx ─────────────────────────────────────────────────────────────
info "Reload Nginx..."
nginx -t && systemctl reload nginx
log "Nginx di-reload"

echo ""
log "Update selesai! Dashboard sudah versi terbaru."
echo ""
