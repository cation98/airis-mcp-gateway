#!/bin/bash
# Generate airis-catalog.yaml from template with 1Password secret injection
# Usage: ./scripts/generate-catalog.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE="$PROJECT_DIR/catalogs/airis-catalog.yaml.template"
OUTPUT="$PROJECT_DIR/catalogs/airis-catalog.yaml"

# Verify 1Password CLI is available and signed in
if ! op whoami &>/dev/null; then
  echo "ERROR: 1Password CLI not signed in. Run 'eval \$(op signin)' first."
  exit 1
fi

# Read secret from 1Password
DB_PASSWORD=$(op read "op://Access Keys/Supabase mindbase DB Password/password")

# Generate catalog from template
sed "s|__MINDBASE_DB_PASSWORD__|${DB_PASSWORD}|g" "$TEMPLATE" > "$OUTPUT"

echo "Generated: $OUTPUT"
echo "Password injected from 1Password (Access Keys vault)"
