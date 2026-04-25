#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deployment/parspack/bootstrap.sh <domain>"
  echo "Example: bash deployment/parspack/bootstrap.sh retrocafebakery.ir"
  exit 1
fi

DOMAIN="$1"
REPO_URL="${REPO_URL:-https://github.com/farshadset/retro.git}"
BRANCH="${BRANCH:-cursor/chess-realtime-app-5487}"
APP_DIR="${APP_DIR:-/opt/realtime-chess}"
NODE_MAJOR="${NODE_MAJOR:-20}"
GO_VERSION="${GO_VERSION:-1.22.2}"
ENABLE_SSL="${ENABLE_SSL:-false}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ "$EUID" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

export PATH="$PATH:/usr/local/go/bin"

log() {
  printf "\n[%s] %s\n" "$(date +'%H:%M:%S')" "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1"
    exit 1
  }
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -v | sed 's/^v//' | cut -d'.' -f1)"
    if [[ "$current_major" == "$NODE_MAJOR" ]]; then
      return
    fi
  fi

  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | ${SUDO} -E bash -
  ${SUDO} apt-get install -y nodejs
}

ensure_go() {
  local desired="go${GO_VERSION}"
  local current
  current="$(go version 2>/dev/null | awk '{print $3}' || true)"
  if [[ "$current" == "$desired" ]]; then
    return
  fi

  log "Installing Go ${GO_VERSION}"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o /tmp/go.tar.gz
  ${SUDO} rm -rf /usr/local/go
  ${SUDO} tar -C /usr/local -xzf /tmp/go.tar.gz

  if ! grep -q "/usr/local/go/bin" "$HOME/.profile"; then
    echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.profile"
  fi

  export PATH="$PATH:/usr/local/go/bin"
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  if rg -n "^${key}=" "$file" >/dev/null 2>&1; then
    sed -i "s|^${key}=.*|${key}=${value}|g" "$file"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$file"
  fi
}

log "Installing base packages"
${SUDO} apt-get update
${SUDO} apt-get install -y nginx curl git build-essential ca-certificates

ensure_node
ensure_go

require_cmd node
require_cmd npm
require_cmd go
require_cmd git
require_cmd nginx

log "Cloning or updating repository"
if [[ ! -d "$APP_DIR/.git" ]]; then
  ${SUDO} mkdir -p "$APP_DIR"
  ${SUDO} chown -R "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
if [[ ! -f "deployment/parspack/nginx-realtime-chess.conf" ]]; then
  echo "Required deployment files were not found in ${APP_DIR}."
  echo "Ensure BRANCH points to the branch containing deployment/parspack assets."
  exit 1
fi
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

log "Installing JavaScript dependencies"
npm install

if [[ ! -f .env.production.local ]]; then
  cp .env.example .env.production.local
fi

log "Writing runtime environment values"
upsert_env ".env.production.local" "NODE_ENV" "production"
upsert_env ".env.production.local" "PORT" "3000"
upsert_env ".env.production.local" "NEXT_PUBLIC_CHESS_API_BASE_URL" "https://${DOMAIN}"
upsert_env ".env.production.local" "GO_CHESS_PORT" "4000"
upsert_env ".env.production.local" "CHESS_STORE_MODE" "memory"
upsert_env ".env.production.local" "CHESS_ROOM_STORE_MAX_ROOMS" "500"
upsert_env ".env.production.local" "CHESS_ROOM_STORE_TTL_MS" "21600000"

log "Building Next.js frontend"
npm run build

log "Building Go chess backend binary"
npm run go:build

log "Starting or reloading PM2 processes"
if npx pm2 describe realtime-chess-web >/dev/null 2>&1; then
  npx pm2 reload realtime-chess-web realtime-chess-api --update-env
else
  npx pm2 start ecosystem.config.cjs --env production
fi
npx pm2 save

log "Configuring Nginx"
${SUDO} cp deployment/parspack/nginx-realtime-chess.conf /etc/nginx/sites-available/realtime-chess
${SUDO} sed -i "s/server_name _;/server_name ${DOMAIN};/g" /etc/nginx/sites-available/realtime-chess
if [[ ! -L /etc/nginx/sites-enabled/realtime-chess ]]; then
  ${SUDO} ln -s /etc/nginx/sites-available/realtime-chess /etc/nginx/sites-enabled/realtime-chess
fi
${SUDO} rm -f /etc/nginx/sites-enabled/default
${SUDO} nginx -t
${SUDO} systemctl reload nginx

if [[ "$ENABLE_SSL" == "true" ]]; then
  if [[ -z "$CERTBOT_EMAIL" ]]; then
    log "ENABLE_SSL=true but CERTBOT_EMAIL is missing. Skipping SSL."
  else
    log "Provisioning SSL certificate with certbot"
    ${SUDO} apt-get install -y certbot python3-certbot-nginx
    ${SUDO} certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
  fi
fi

log "Health check"
curl -fsS "http://127.0.0.1:4000/api/health" || true
curl -fsS "http://127.0.0.1:3000" >/dev/null || true

log "Done. Deployment is ready on domain: ${DOMAIN}"
