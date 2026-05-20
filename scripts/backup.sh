#!/usr/bin/env bash
# Encrypted SQLite backup. Use a hot-copy via the SQLite CLI so we never read a
# torn WAL frame mid-checkpoint. Pipes straight into gpg so the cleartext .db
# never touches disk.
#
# Usage (locally, after `railway link`):
#   BACKUP_GPG_RECIPIENT=you@example.com ./scripts/backup.sh
#
# Or run inside the Railway shell (Service -> three-dot menu -> Shell):
#   apt-get update && apt-get install -y sqlite3 gnupg   # one-time
#   BACKUP_GPG_RECIPIENT=you@example.com /app/scripts/backup.sh
#
# Output: ./backups/amari-YYYYmmdd-HHMMSS.db.gpg
#
# To restore:
#   gpg --decrypt amari-...-....db.gpg > restored.db
#   # then copy restored.db into the Railway volume at /data/amari.db

set -euo pipefail

DB_PATH="${DB_PATH:-./data/amari.db}"
OUT_DIR="${BACKUP_OUT_DIR:-./backups}"
TS="$(date -u +%Y%m%d-%H%M%S)"

if [[ ! -f "$DB_PATH" ]]; then
  echo "error: database not found at $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "error: sqlite3 CLI missing. Install: apt-get install -y sqlite3" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "error: gpg missing. Install: apt-get install -y gnupg" >&2
    exit 1
  fi
  OUT="$OUT_DIR/amari-$TS.db.gpg"
  echo "Backing up to $OUT (encrypted for $BACKUP_GPG_RECIPIENT)"
  sqlite3 "$DB_PATH" ".backup '/dev/stdout'" \
    | gpg --batch --yes --trust-model always \
          --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
          --output "$OUT"
elif [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  OUT="$OUT_DIR/amari-$TS.db.gpg"
  echo "Backing up to $OUT (symmetric passphrase)"
  sqlite3 "$DB_PATH" ".backup '/dev/stdout'" \
    | gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" \
          --symmetric --cipher-algo AES256 \
          --output "$OUT"
else
  OUT="$OUT_DIR/amari-$TS.db"
  echo "WARNING: no BACKUP_GPG_RECIPIENT or BACKUP_PASSPHRASE set — writing PLAINTEXT backup" >&2
  echo "         Set one of those env vars before running off-site uploads." >&2
  sqlite3 "$DB_PATH" ".backup '$OUT'"
fi

SIZE=$(du -h "$OUT" | cut -f1)
echo "Done. $OUT ($SIZE)"
