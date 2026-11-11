# CLAUDE.md

Espace de travail d'études : web app mono-utilisateur, auto-hébergée.
Le besoin, le modèle de données et les décisions figées sont dans `CADRAGE.md`. Le lire avant toute tâche. En cas de conflit, `CADRAGE.md` fait foi.

## Principes

- Sobriété : la solution la plus simple qui répond au cadrage. Pas de fonctionnalité, d'abstraction ni de dépendance non demandée.
- Une tranche à la fois, livrée de bout en bout (base, API, écran). Ne jamais anticiper une tranche suivante.
- Avant de coder une tâche non triviale : proposer un plan court et attendre la validation.
- Décision d'architecture absente du cadrage : poser la question, ne pas trancher seul.
- Toute nouvelle dépendance doit être justifiée dans la description de la PR.

## Structure du dépôt

```
front/    Angular
api/      NestJS
docker/   Dockerfiles, Compose, reverse proxy
deploy/   scripts lancés sur le serveur (préparation, mise en production)
contracts/ exemples partagés et testés des deux côtés (contenu d'un cours)
docs/     décisions et procédures (sauvegarde, restauration, déploiement)
```

## Commandes

À compléter en tranche 0, puis à tenir à jour : installation, lancement local (Docker Compose), tests, lint, build, création et exécution des migrations.

Version de Node : voir `.nvmrc`. Variables d'environnement : copier `.env.example` en `.env` à la racine.

### Pile complète (à la racine, Docker Compose)

| Action | Commande |
|---|---|
| Construire et démarrer | `docker compose up --build -d` |
| État des conteneurs | `docker compose ps` |
| Journaux | `docker compose logs -f` |
| Arrêter | `docker compose down` |
| Arrêter et effacer les données locales | `docker compose down -v` |
| Appliquer les migrations | `docker compose exec api npm run migration:run` |
| Publier la base sur l'hôte (développement) | décommenter `COMPOSE_FILE` dans `.env` |
| Créer le compte (une seule fois) | `docker compose exec api npm run user:create` |

L'application est servie sur https://localhost. En local, le certificat vient de l'autorité interne de Caddy : le navigateur affiche un avertissement à accepter.

### Production (sur le serveur, dans `/srv/learn`)

Procédures complètes : `docs/deploiement.md`, `docs/sauvegarde.md`, `docs/restauration.md`.

| Action | Commande |
|---|---|
| Préparer un serveur vierge | `sudo ./deploy/setup-server.sh <nom-de-domaine> ['<clé publique du pipeline>']` |
| Mettre une version en production | `sudo -u deploy ./deploy/deploy.sh <tag>` |
| Sauvegarder maintenant | `sudo -u deploy -H ./deploy/backup.sh` |
| Lister les sauvegardes | `sudo -u deploy -H ./deploy/restore.sh` |
| Restaurer une sauvegarde | `sudo -u deploy -H ./deploy/restore.sh <horodatage>` |

### API (dans `api/`)

| Action | Commande |
|---|---|
| Installation | `npm ci` |
| Lancement local avec rechargement | `npm run start:dev` |
| Lint | `npm run lint` |
| Vérification du formatage | `npm run format:check` |
| Formatage | `npm run format` |
| Tests unitaires | `npm test` |
| Tests d'intégration | `npm run test:e2e` |
| Build | `npm run build` |
| Créer une migration | ajouter `src/database/migrations/<horodatage>-<sujet>.ts` et l'inscrire dans `migrations/index.ts` |
| Appliquer les migrations | `npm run build && npm run migration:run` |
| Annuler la dernière migration | `npm run build && npm run migration:revert` |
| État des migrations | `npm run build && npm run migration:show` |

Hors Docker, l'API, les tests d'intégration et les migrations ont besoin de la base publiée sur l'hôte (complément `compose.dev.yaml`). Les tests d'intégration recréent à chaque exécution une base `<DATABASE_NAME>_test`.

### Front (dans `front/`)

| Action | Commande |
|---|---|
| Installation | `npm ci` |
| Lancement local avec rechargement | `npm start` (http://localhost:4200), avec l'API lancée par `npm run start:dev` : `/api` lui est relayé par `proxy.conf.json` |
| Lint | `npm run lint` |
| Vérification du formatage | `npm run format:check` |
| Formatage | `npm run format` |
| Tests | `npm test` |
| Build | `npm run build` |

## Langue et nommage

- Code, identifiants, noms de fichiers, tables et colonnes : anglais.
- Interface utilisateur, messages d'erreur affichés, commits, PR et documentation : français.
- Fichiers en kebab-case, classes en PascalCase, variables et fonctions en camelCase, tables et colonnes en snake_case.

## TypeScript (front et API)

- Mode `strict` activé. Pas de `any` ; `unknown` puis affinage si le type est réellement inconnu.
- Pas de `// @ts-ignore` ni de désactivation de règle de lint sans commentaire expliquant pourquoi.
- Fonctions courtes à responsabilité unique. Pas de code mort ni de code commenté.
- ESLint et Prettier : zéro avertissement avant de proposer une PR.

## Angular

- Composants standalone uniquement, détection de changement `OnPush`.
- État local et dérivé avec les signals (`signal`, `computed`, `input`, `output`). RxJS réservé aux flux asynchrones (HTTP, événements).
- Syntaxe de contrôle native dans les templates (`@if`, `@for`, `@switch`).
- Injection avec `inject()`.
- Organisation par fonctionnalité (`features/ue`, `features/cours`, `features/termes`...), chaque fonctionnalité chargée en différé par le routeur.
- Composants de présentation sans appel HTTP : les appels passent par un service de la fonctionnalité.
- Formulaires réactifs typés.
- Erreurs HTTP et session expirée traitées par un intercepteur unique.
- Accessibilité de base : navigation au clavier, libellés, contrastes.

## NestJS

- Un module par domaine (`ue`, `courses`, `terms`, `files`, `search`, `auth`).
- Contrôleurs fins : validation et routage uniquement. La logique métier est dans les services.
- Toute entrée validée par un DTO ; `ValidationPipe` global en mode liste blanche, propriétés inconnues rejetées.
- Authentification par garde globale ; une route publique est une exception explicite.
- Erreurs : exceptions HTTP de Nest, format de réponse d'erreur unique.
- Configuration par variables d'environnement, validées au démarrage. Aucun secret dans le code ni dans le dépôt ; `.env.example` tenu à jour.
- API REST préfixée `/api`, noms de ressources au pluriel.

## PostgreSQL

- Schéma modifié uniquement par migrations versionnées. Synchronisation automatique du schéma interdite.
- Une migration appliquée n'est jamais modifiée : on en ajoute une nouvelle.
- Clés étrangères et contraintes (`NOT NULL`, `UNIQUE`) déclarées en base, pas seulement dans le code.
- Dates en `timestamptz`. Index sur les clés étrangères et les colonnes de recherche.
- Requêtes paramétrées uniquement ; aucune concaténation de valeurs dans du SQL.
- Opérations touchant plusieurs tables dans une transaction.

## Docker

- Mêmes images en local et en production ; seules les variables d'environnement diffèrent.
- Builds multi-étapes, images d'exécution minimales, processus non root.
- Versions d'images épinglées (pas de `latest`).
- Données persistantes (base, fichiers envoyés) dans des volumes nommés.

## Sécurité

Appliquer la section 6 de `CADRAGE.md` sans exception : l'application est exposée sur Internet. Toute route, tout envoi de fichier et tout contenu affiché doivent être pensés comme hostiles par défaut.

## Tests

- API : tests unitaires des services contenant de la logique, tests d'intégration des routes principales (cas nominal, entrée invalide, accès non authentifié).
- Front : tests des services et des composants contenant de la logique. Pas de test pour l'affichage pur.
- Un correctif de bug est accompagné du test qui le reproduit.
- Tous les tests passent avant de proposer une PR.

## Flux Git

| Branche | Rôle | Règle |
|---|---|---|
| `main` | Production | Uniquement par PR depuis `develop`, à la fin d'une tranche, avec tag de version |
| `develop` | Intégration | Uniquement par PR depuis une branche de fonctionnalité |
| `feature/<tranche>-<sujet>` | Travail en cours | Créée depuis `develop`, courte durée de vie |
| `fix/<sujet>` | Correctif | Créée depuis `develop` |

- Jamais de commit direct ni de push forcé sur `main` ou `develop`.
- Commits atomiques au format Conventional Commits, en français : `feat(cours): ajoute l'import d'un paquet de cours`. Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Rebase sur `develop` avant d'ouvrir la PR. Fusion en squash.
- Une branche fusionnée est supprimée aussitôt, en local et sur GitHub : `gh pr merge --squash --delete-branch`. `main` et `develop` ne sont jamais supprimées.

## Pull requests

- Une PR par sujet, de taille relisible. Au-delà d'environ 400 lignes modifiées, découper.
- Description obligatoire : objectif, ce qui change, comment tester, points d'attention, dépendances ajoutées.
- Avant d'ouvrir : lint, tests et build passent ; migrations incluses ; `CLAUDE.md` et `docs/` mis à jour si une commande ou une procédure change.
- Claude Code ouvre la PR, la fusionne en squash dans `develop` une fois lint, tests et build passés, en local comme dans le pipeline (`.github/workflows/ci.yml`), puis supprime la branche. Pierre valide les fonctionnalités dans l'interface avant le passage à la suite.

## Interdits

- Modifier `CADRAGE.md` sans demande explicite.
- Désactiver un test, une règle de lint ou une vérification de sécurité pour faire passer un build.
- Committer des secrets, des données personnelles ou des fichiers de cours réels.
- Pousser directement sur `main` ou `develop`.
- Fusionner vers `main` sans validation de Pierre.
