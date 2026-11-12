#!/usr/bin/env bash
# Met en production une version étiquetée : récupération du tag, construction des
# images, migrations, redémarrage, puis vérification que l'application répond.
#
# Usage, sur le serveur : ./deploy/deploy.sh v1.2.3
# Le pipeline passe par SSH : la clé y est restreinte à ce script, qui lit alors
# le tag demandé dans SSH_ORIGINAL_COMMAND.
set -euo pipefail

readonly LOCK_FILE=/run/lock/learn-deploy.lock
readonly HEALTH_CHECK="fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

fail() {
  echo "Erreur : $*" >&2
  exit 1
}

# Le tag vient de l'extérieur : rien d'autre qu'un numéro de version n'est accepté.
read_tag() {
  local tag=${1:-${SSH_ORIGINAL_COMMAND:-}}
  [[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "tag attendu au format v1.2.3."
  echo "$tag"
}

# Le script se relance après la récupération du tag : c'est la version étiquetée qui déploie.
checkout_release() {
  local tag=$1
  if [[ ${LEARN_RELEASE:-} == "$tag" ]]; then
    return
  fi
  git fetch --quiet --tags --force origin
  git checkout --quiet --detach "refs/tags/$tag"
  LEARN_RELEASE=$tag exec "$0" "$tag"
}

wait_until_healthy() {
  for _ in {1..30}; do
    if docker compose exec -T api node -e "$HEALTH_CHECK" 2>/dev/null; then
      return
    fi
    sleep 2
  done
  docker compose ps
  fail "l'application ne répond pas après le redémarrage (voir : docker compose logs api)."
}

main() {
  local tag
  tag=$(read_tag "$@")
  cd "$(dirname "$(readlink -f "$0")")/.."

  exec 9>"$LOCK_FILE"
  flock -n 9 || fail "un déploiement est déjà en cours."

  checkout_release "$tag"
  docker compose build
  docker compose run --rm -T api npm run migration:run
  docker compose up -d --remove-orphans
  wait_until_healthy
  docker image prune -f >/dev/null
  echo "Version $tag en production."
}

main "$@"
