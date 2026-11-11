#!/usr/bin/env bash
# Prépare un serveur Ubuntu vierge à recevoir l'application : Docker, pare-feu,
# utilisateur de déploiement, fichier .env, accès SSH par clé uniquement.
# Peut être relancé sans risque : chaque étape ne fait que ce qui manque.
#
# Usage : sudo ./deploy/setup-server.sh <nom-de-domaine> ['<clé publique du pipeline>']
set -euo pipefail

readonly DEPLOY_USER=deploy
readonly SWAP_FILE=/swapfile
readonly SSH_CONFIG=/etc/ssh/sshd_config.d/00-learn.conf

APP_DIR=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
readonly APP_DIR
readonly DOMAIN=${1:-}
readonly PIPELINE_KEY=${2:-}

fail() {
  echo "Erreur : $*" >&2
  exit 1
}

check_arguments() {
  [[ $EUID -eq 0 ]] || fail "à lancer avec sudo."
  [[ $DOMAIN =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] ||
    fail "nom de domaine attendu en premier argument, par exemple learn.example.org."
  [[ -z $PIPELINE_KEY || $PIPELINE_KEY =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9@._-]+)?$ ]] ||
    fail "la clé du pipeline doit être une clé publique ed25519 (contenu du fichier .pub)."
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get upgrade -y -q
  # Paquets d'Ubuntu : leurs correctifs de sécurité arrivent par les mises à jour automatiques.
  apt-get install -y -q docker.io docker-compose-v2 docker-buildx git ufw openssl unattended-upgrades
  systemctl enable --now docker
}

# Docker publie lui-même les ports 80 et 443 ; le pare-feu ferme tout le reste.
configure_firewall() {
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

# La construction du front dépasse la mémoire d'un petit serveur sans espace d'échange.
create_swap() {
  if [[ -n $(swapon --show --noheadings) || -e $SWAP_FILE ]]; then
    return
  fi
  fallocate -l 2G "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
  swapon "$SWAP_FILE"
  echo "$SWAP_FILE none swap sw 0 0" >>/etc/fstab
}

# Le groupe « docker » donne en pratique les droits de root : ce compte ne sert qu'au déploiement.
create_deploy_user() {
  if ! id "$DEPLOY_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
  fi
  usermod -aG docker "$DEPLOY_USER"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
}

# Les secrets sont générés ici et ne quittent jamais le serveur.
create_env_file() {
  local env_file=$APP_DIR/.env
  if [[ -e $env_file ]]; then
    return
  fi
  (
    umask 077
    cat >"$env_file" <<ENV
SITE_ADDRESS=$DOMAIN
DATABASE_NAME=learn
DATABASE_USER=learn
DATABASE_PASSWORD=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENV
  )
  chown "$DEPLOY_USER:$DEPLOY_USER" "$env_file"
}

# La clé du pipeline ne peut lancer que le script de déploiement : ni terminal, ni tunnel.
authorize_pipeline() {
  if [[ -z $PIPELINE_KEY ]]; then
    return
  fi
  local ssh_dir=/home/$DEPLOY_USER/.ssh
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
  echo "restrict,command=\"$APP_DIR/deploy/deploy.sh\" $PIPELINE_KEY" >"$ssh_dir/authorized_keys"
  chmod 600 "$ssh_dir/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ssh_dir/authorized_keys"
}

# Les mots de passe ne sont coupés que si l'administrateur a déjà une clé : sinon il s'enfermerait dehors.
harden_ssh() {
  local admin=${SUDO_USER:-root}
  local admin_home
  admin_home=$(getent passwd "$admin" | cut -d: -f6)
  if [[ ! -s $admin_home/.ssh/authorized_keys ]]; then
    echo "ATTENTION : aucune clé SSH pour « $admin », la connexion par mot de passe reste ouverte." >&2
    echo "Ajoutez votre clé publique dans $admin_home/.ssh/authorized_keys, puis relancez ce script." >&2
    return
  fi
  cat >"$SSH_CONFIG" <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
  sshd -t
  systemctl reload ssh
}

main() {
  check_arguments
  install_packages
  configure_firewall
  create_swap
  create_deploy_user
  create_env_file
  authorize_pipeline
  harden_ssh
  echo "Serveur prêt. Premier déploiement : sudo -u $DEPLOY_USER $APP_DIR/deploy/deploy.sh <tag>"
}

main
