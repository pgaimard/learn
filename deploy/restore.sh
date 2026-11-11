#!/usr/bin/env bash
# Restaure une sauvegarde : la base et les fichiers envoyés sont REMPLACÉS par ceux
# de la sauvegarde choisie.
#
# Usage : ./deploy/restore.sh                    liste les sauvegardes disponibles
#         ./deploy/restore.sh 2026-01-31T0315Z   restaure celle-ci
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."
# shellcheck source=deploy/backup-lib.sh
source deploy/backup-lib.sh

list_backups() {
  echo "Sauvegardes disponibles :"
  rclone lsf --include "learn-*.dump" "$1" | sed -E 's/^learn-(.*)\.dump$/  \1/' | sort
}

confirm() {
  local answer
  read -r -p "La base et les fichiers actuels seront remplacés par la sauvegarde $1. Tapez « restaurer » pour continuer : " answer
  [[ $answer == restaurer ]] || fail "restauration abandonnée."
}

restore_database() {
  # shellcheck disable=SC2016 # les variables sont celles du conteneur, pas de ce script
  docker compose exec -T db sh -c '
    dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" &&
    createdb -U "$POSTGRES_USER" "$POSTGRES_DB" &&
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' <"$1"
}

restore_uploads() {
  docker compose run --rm -T --no-deps api sh -c '
    find /data/uploads -mindepth 1 -delete && tar -xzf - -C /data' <"$1"
}

# Dossier de travail, supprimé à la sortie du script quoi qu'il arrive.
work=
trap '[[ -z $work ]] || rm -rf "$work"' EXIT

main() {
  local remote stamp=${1:-}
  remote=$(backup_remote)
  if [[ -z $stamp ]]; then
    list_backups "$remote"
    return
  fi
  [[ $stamp =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z$ ]] || fail "horodatage attendu, par exemple 2026-01-31T0315Z."
  confirm "$stamp"

  work=$(mktemp -d)
  rclone copy --include "learn-$stamp*" "$remote" "$work"
  [[ -s $work/learn-$stamp.dump && -s $work/learn-$stamp-uploads.tar.gz ]] ||
    fail "sauvegarde $stamp introuvable ou incomplète."

  docker compose stop api
  restore_database "$work/learn-$stamp.dump"
  restore_uploads "$work/learn-$stamp-uploads.tar.gz"
  docker compose up -d
  echo "Sauvegarde $stamp restaurée."
}

main "$@"
