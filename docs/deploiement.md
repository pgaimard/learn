# Déploiement

L'application tourne sur un serveur Ubuntu, dans Docker Compose, avec les mêmes images qu'en local. Le reverse proxy (Caddy) obtient et renouvelle seul le certificat HTTPS.

Dans ce document, `learn.example.org` remplace le vrai nom de domaine, qui n'est écrit que dans le fichier `.env` du serveur.

## Ce qui est installé sur le serveur

| Élément | Rôle |
|---|---|
| `/srv/learn` | Copie du dépôt, placée sur le tag en production |
| `/srv/learn/.env` | Nom de domaine et secrets, générés sur place, lisibles par `deploy` seul |
| Utilisateur `deploy` | Propriétaire du dépôt, lance Docker. Sans mot de passe |
| Pare-feu `ufw` | Ports 22, 80 et 443 uniquement |
| Tâche `cron` | Sauvegarde quotidienne (voir `sauvegarde.md`) |
| SSH | Connexion par clé uniquement |
| Volumes Docker | Base (`learn_db_data`), fichiers envoyés (`learn_uploads`), certificats (`learn_proxy_data`) |

## Première installation

Prérequis : un serveur Ubuntu 26.04 vierge, installé avec votre clé SSH publique, et un enregistrement DNS de type A du nom de domaine vers l'adresse du serveur.

### 1. Préparer le serveur

En SSH sur le serveur, avec le compte d'administration :

```bash
sudo apt-get update && sudo apt-get install -y git
```

```bash
sudo git clone https://github.com/pgaimard/learn.git /srv/learn
```

```bash
sudo /srv/learn/deploy/setup-server.sh learn.example.org
```

Le script installe Docker, ferme le pare-feu, crée l'utilisateur `deploy`, génère le fichier `.env`, planifie la sauvegarde quotidienne et coupe la connexion SSH par mot de passe. Il peut être relancé sans risque : il ne refait que ce qui manque, et ne touche jamais à un `.env` existant.

S'il affiche « aucune clé SSH », la connexion par mot de passe est restée ouverte : ajoutez votre clé publique au compte d'administration, puis relancez-le.

Avant de fermer la session, ouvrez-en une seconde pour vérifier que la connexion par clé fonctionne.

### 2. Mettre en production

```bash
sudo -u deploy /srv/learn/deploy/deploy.sh v0.8.0
```

Le script récupère le tag, construit les images, applique les migrations, redémarre l'application et vérifie qu'elle répond. La première construction prend plusieurs minutes.

### 3. Créer le compte

Une seule fois ; la commande demande l'identifiant et le mot de passe :

```bash
cd /srv/learn && sudo -u deploy docker compose exec api npm run user:create
```

L'application répond alors sur `https://learn.example.org`. Le certificat est demandé au premier accès : la toute première page peut mettre quelques secondes.

## Autoriser le pipeline

Le pipeline se connecte en SSH avec une clé qui ne peut faire qu'une chose : lancer `deploy/deploy.sh` avec un numéro de version. Elle n'ouvre ni terminal, ni tunnel.

Sur votre poste, créez une paire de clés réservée au pipeline :

```bash
ssh-keygen -t ed25519 -N "" -C learn-pipeline -f ~/.ssh/learn-pipeline
```

Sur le serveur, relancez la préparation avec le contenu de `~/.ssh/learn-pipeline.pub` :

```bash
sudo /srv/learn/deploy/setup-server.sh learn.example.org 'ssh-ed25519 AAAA… learn-pipeline'
```

Relancer la commande avec une nouvelle clé publique remplace l'ancienne.

Dans le dépôt GitHub, sous Settings → Secrets and variables → Actions, créez trois secrets :

| Secret | Valeur |
|---|---|
| `DEPLOY_SSH_KEY` | Contenu du fichier `~/.ssh/learn-pipeline` (la clé privée, en entier) |
| `DEPLOY_HOST` | Nom de domaine du serveur |
| `DEPLOY_KNOWN_HOSTS` | Résultat de la commande ci-dessous, lancée depuis votre poste |

```bash
ssh-keyscan -t ed25519 learn.example.org
```

Ce dernier secret épingle l'identité du serveur : le pipeline refuse de se connecter à une autre machine. Une fois les secrets créés, supprimez la clé privée de votre poste.

## Pipeline

`.github/workflows/ci.yml` fait deux choses :

- sur chaque PR vers `develop` ou `main` : lint, formatage, tests et build de l'API et du front ;
- sur chaque tag `v*` : les mêmes vérifications, puis la mise en production si elles passent.

Le pipeline ne construit aucune image et ne détient aucun secret de l'application : il demande au serveur de déployer le tag et attend le résultat.

## Mettre à jour

Chaque version est un tag `v1.2.3` posé sur `main`. Le pipeline la déploie (onglet Actions du dépôt pour suivre) ; à la main, c'est la même commande que la première fois :

```bash
sudo -u deploy /srv/learn/deploy/deploy.sh v1.2.3
```

## Revenir à la version précédente

Redéployer l'ancien tag remet l'ancien code, mais n'annule pas les migrations déjà appliquées. Si la version à retirer a modifié le schéma, annulez d'abord ses migrations, une par une, tant qu'elle est encore en place :

```bash
cd /srv/learn && sudo -u deploy docker compose exec api npm run migration:revert
```

## Diagnostic

Toutes les commandes se lancent dans `/srv/learn`, précédées de `sudo -u deploy`.

| Besoin | Commande |
|---|---|
| État des conteneurs | `docker compose ps` |
| Journaux de l'API | `docker compose logs --tail 100 api` |
| Journaux du proxy (certificat) | `docker compose logs --tail 100 proxy` |
| Version en place | `git describe --tags` |

Si le certificat n'arrive pas : vérifier que le nom de domaine pointe bien vers le serveur et que les ports 80 et 443 sont ouverts chez l'hébergeur.
