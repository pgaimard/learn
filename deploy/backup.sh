#!/usr/bin/env bash
# Sauvegarde quotidienne : export de la base et archive des fichiers envoyés, déposés
# dans le stockage objet, puis suppression des sauvegardes de plus de 30 jours.
# Lancé chaque nuit par cron (voir deploy/setup-server.sh) ; se lance aussi à la main.
set -euo pipefail

readonly RETENTION=30d

cd "$(dirname "$(readlink -f "$0")")/.."
# shellcheck source=deploy/backup-lib.sh
source deploy/backup-lib.sh

# Dossier de travail, supprimé à la sortie du script quoi qu'il arrive.
work=
trap '[[ -z $work ]] || rm -rf "$work"' EXIT

main() {
  local remote stamp
  remote=$(backup_remote)
  stamp=$(date -u +%Y-%m-%dT%H%MZ)
  work=$(mktemp -d)

  # shellcheck disable=SC2016 # les variables sont celles du conteneur, pas de ce script
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
    >"$work/learn-$stamp.dump"
  docker compose exec -T api tar -czf - -C /data uploads >"$work/learn-$stamp-uploads.tar.gz"

  rclone copy "$work" "$remote"
  # Rien n'est supprimé si l'envoi a échoué : le script s'est arrêté avant.
  rclone delete --min-age "$RETENTION" "$remote"
  echo "Sauvegarde $stamp envoyée."
}

main
