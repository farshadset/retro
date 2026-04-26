#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-docker-dist}"
TAG="${TAG:-latest}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mkdir -p "$OUTPUT_DIR/images"

echo "[1/5] Building Docker images..."
docker compose build

echo "[2/5] Tagging images..."
docker tag retrochess-web:latest "retrochess-web:${TAG}"
docker tag retrochess-api:latest "retrochess-api:${TAG}"
docker tag retrochess-gateway:latest "retrochess-gateway:${TAG}"

echo "[3/5] Saving images as tar files..."
docker save -o "${OUTPUT_DIR}/images/retrochess-web-${TAG}.tar" "retrochess-web:${TAG}"
docker save -o "${OUTPUT_DIR}/images/retrochess-api-${TAG}.tar" "retrochess-api:${TAG}"
docker save -o "${OUTPUT_DIR}/images/retrochess-gateway-${TAG}.tar" "retrochess-gateway:${TAG}"

echo "[4/5] Writing runtime compose and env templates..."
cat > "${OUTPUT_DIR}/docker-compose.yml" <<EOF
services:
  web:
    image: retrochess-web:${TAG}
    container_name: retrochess-web
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: \${PORT:-3000}
      NEXT_PUBLIC_CHESS_API_BASE_URL: \${NEXT_PUBLIC_CHESS_API_BASE_URL:-}
    expose:
      - "3000"

  api:
    image: retrochess-api:${TAG}
    container_name: retrochess-api
    restart: unless-stopped
    env_file:
      - .env
    environment:
      GO_CHESS_PORT: \${GO_CHESS_PORT:-4000}
      CHESS_STORE_MODE: \${CHESS_STORE_MODE:-memory}
      CHESS_ROOM_STORE_MAX_ROOMS: \${CHESS_ROOM_STORE_MAX_ROOMS:-500}
      CHESS_ROOM_STORE_TTL_MS: \${CHESS_ROOM_STORE_TTL_MS:-21600000}
    expose:
      - "4000"

  gateway:
    image: retrochess-gateway:${TAG}
    container_name: retrochess-gateway
    restart: unless-stopped
    depends_on:
      - web
      - api
    ports:
      - "80:80"
EOF
cp .env.example "${OUTPUT_DIR}/.env.example"

cat > "${OUTPUT_DIR}/run-on-server.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not installed."
  exit 1
fi

if [[ ! -f ".env" ]]; then
  cp .env.example .env
fi

echo "Loading image tar files..."
docker load -i images/retrochess-web-*.tar
docker load -i images/retrochess-api-*.tar
docker load -i images/retrochess-gateway-*.tar

echo "Starting stack..."
docker compose up -d

echo "Done. Check:"
echo "  docker compose ps"
echo "  curl http://127.0.0.1/api/health"
EOF

chmod +x "${OUTPUT_DIR}/run-on-server.sh"

echo "[5/5] Creating compressed bundle..."
tar -czf "${OUTPUT_DIR}.tar.gz" -C "$(dirname "${OUTPUT_DIR}")" "$(basename "${OUTPUT_DIR}")"

echo "Bundle created:"
echo "  ${OUTPUT_DIR}.tar.gz"
echo
echo "Upload this file to VPS and run:"
echo "  tar -xzf ${OUTPUT_DIR}.tar.gz"
echo "  cd ${OUTPUT_DIR}"
echo "  bash run-on-server.sh"
