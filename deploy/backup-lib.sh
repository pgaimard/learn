# Réglages communs à la sauvegarde et à la restauration. Fichier inclus, jamais lancé seul.

# Remote rclone créé sur le serveur (voir docs/sauvegarde.md) : les identifiants du
# stockage objet ne sont que dans la configuration rclone de l'utilisateur deploy.
readonly BACKUP_REMOTE_NAME=learn-backup

fail() {
  echo "Erreur : $*" >&2
  exit 1
}

# Destination des sauvegardes : le conteneur nommé par BACKUP_BUCKET dans le .env du serveur.
backup_remote() {
  local bucket
  bucket=$(sed -n 's/^BACKUP_BUCKET=//p' .env)
  [[ $bucket =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] ||
    fail "BACKUP_BUCKET est absent ou invalide dans .env (voir docs/sauvegarde.md)."
  echo "$BACKUP_REMOTE_NAME:$bucket"
}
