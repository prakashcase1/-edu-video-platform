#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# MinIO bucket initialization script
# Run after: docker compose up -d
# ─────────────────────────────────────────────────────────────────

set -e

MINIO_URL="${MINIO_URL:-http://localhost:9000}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin123}"
BUCKET="${AWS_S3_BUCKET:-eduvideo}"

echo "Waiting for MinIO to start..."
until curl -sf "${MINIO_URL}/minio/health/live" > /dev/null 2>&1; do
  sleep 2
done
echo "MinIO is up!"

# Install mc if not present
if ! command -v mc &> /dev/null; then
  echo "Installing MinIO client..."
  curl -sf https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

mc alias set local "${MINIO_URL}" "${MINIO_USER}" "${MINIO_PASS}"

# Create bucket if it doesn't exist
if ! mc ls "local/${BUCKET}" > /dev/null 2>&1; then
  mc mb "local/${BUCKET}"
  echo "Created bucket: ${BUCKET}"
fi

# Set public read policy for video files
mc anonymous set download "local/${BUCKET}"
echo "Bucket '${BUCKET}' is ready with public download access."

# Set lifecycle policy to clean temp files after 7 days
mc ilm add --expiry-days 7 "local/${BUCKET}/tmp/"
echo "Lifecycle policy set: temp files expire after 7 days."

echo "MinIO setup complete!"
