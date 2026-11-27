#!/usr/bin/env bash
# Restaure une sauvegarde : la base et les fichiers envoyés sont REMPLACÉS par ceux
# de la sauvegarde choisie.
#
# Usage : ./deploy/restore.sh                       liste les sauvegardes disponibles
#         ./deploy/restore.sh 2026-01-31T0315Z      restaure celle-ci
#         ./deploy/restore.sh --fichier <archive>   restaure un export téléchargé depuis
#                                                   l'écran d'administration
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
  read -r -p "La base et les fichiers actuels seront remplacés par $1. Tapez « restaurer » pour continuer : " answer
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

# Remplace la base et les fichiers par ceux des deux fichiers donnés.
apply() {
  docker compose stop api
  restore_database "$1"
  restore_uploads "$2"
  docker compose up -d
}

# Export de l'écran d'administration : une archive qui contient les deux fichiers d'une
# sauvegarde, sous les mêmes noms.
restore_export() {
  local archive=$1 dumps uploads
  [[ -f $archive ]] || fail "archive introuvable : ${archive:-aucun fichier donné}."
  work=$(mktemp -d)
  tar -xf "$archive" -C "$work" || fail "archive illisible : $archive."
  dumps=("$work"/learn-*.dump)
  uploads=("$work"/learn-*-uploads.tar.gz)
  [[ ${#dumps[@]} -eq 1 && -s ${dumps[0]} && ${#uploads[@]} -eq 1 && -s ${uploads[0]} ]] ||
    fail "ce fichier n'est pas un export complet de l'application."

  confirm "l'export $(basename "$archive")"
  apply "${dumps[0]}" "${uploads[0]}"
  echo "Export $(basename "$archive") restauré."
}

main() {
  local remote stamp=${1:-}
  if [[ $stamp == --fichier ]]; then
    restore_export "${2:-}"
    return
  fi
  remote=$(backup_remote)
  if [[ -z $stamp ]]; then
    list_backups "$remote"
    return
  fi
  [[ $stamp =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z$ ]] || fail "horodatage attendu, par exemple 2026-01-31T0315Z."
  confirm "la sauvegarde $stamp"

  work=$(mktemp -d)
  rclone copy --include "learn-$stamp*" "$remote" "$work"
  [[ -s $work/learn-$stamp.dump && -s $work/learn-$stamp-uploads.tar.gz ]] ||
    fail "sauvegarde $stamp introuvable ou incomplète."

  apply "$work/learn-$stamp.dump" "$work/learn-$stamp-uploads.tar.gz"
  echo "Sauvegarde $stamp restaurée."
}

main "$@"
