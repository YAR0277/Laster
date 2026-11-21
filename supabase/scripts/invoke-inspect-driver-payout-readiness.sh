#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/Customer/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Cannot find $ENV_FILE" >&2
  exit 1
fi

KEY="$(grep -m1 '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE" \
  | cut -d '=' -f2- | tr -d "\"'" | tr -d '\r')"

if [[ -z "$KEY" ]]; then
  echo "Supabase publishable key not found." >&2
  exit 1
fi

curl --fail-with-body --silent --show-error -X POST \
  'https://hgmohmaxuwvexqbnblnc.supabase.co/functions/v1/inspect-driver-payout-readiness' \
  -H "apikey: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"driverId":"9cae251f-88f9-4cd8-86f1-a4febb5a18bc"}'

echo
