#!/usr/bin/env bash
# Backup da base SQLite do Agente Galicia CRM.
# Sugestão de cron (diário às 3h), como o utilizador do serviço:
#   0 3 * * * /opt/agente-galicia-crm/app/deploy/backup.sh
set -euo pipefail

DB_PATH="/mnt/donotact-data/agente-galicia-crm/data/contacts.sqlite"
BACKUP_DIR="/mnt/donotact-data/agente-galicia-crm/backups"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/contacts-$TS.sqlite'"

# Mantém só os últimos 30 backups.
ls -1t "$BACKUP_DIR"/contacts-*.sqlite 2>/dev/null | tail -n +31 | xargs -r rm --
