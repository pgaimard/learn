# Sauvegarde

Chaque nuit à 3 h 15, le serveur exporte la base, archive les fichiers envoyés, et dépose les deux dans un conteneur de stockage objet. Les sauvegardes de plus de 30 jours sont supprimées.

Le cadrage parlait d'un second disque : sur un serveur loué, le stockage objet joue ce rôle, hors du serveur.

## Ce qui est sauvegardé

| Fichier dans le conteneur | Contenu |
|---|---|
| `learn-<date>.dump` | Base complète (`pg_dump`, format personnalisé) |
| `learn-<date>-uploads.tar.gz` | Images des cours et des termes, fichiers des UE |

`<date>` est l'horodatage UTC de la sauvegarde, par exemple `2026-01-31T0315Z`.

Le fichier `.env` du serveur n'est pas sauvegardé : il se régénère (voir « Serveur perdu » dans `docs/restauration.md`).

## Mise en place

Les identifiants du stockage objet ne sont écrits qu'à un endroit : la configuration `rclone` de l'utilisateur `deploy`, sur le serveur.

### 1. Créer le conteneur et son utilisateur

Dans l'espace client de l'hébergeur, partie stockage objet :

| Réglage | Choix | Pourquoi |
|---|---|---|
| API | S3 | C'est celle que `rclone` utilise ici |
| Région | Une autre que celle du serveur, si possible | Un incident sur le centre de données ne doit pas emporter le serveur et ses sauvegardes |
| Classe de stockage | Standard | Les sauvegardes sont petites et relues à chaque restauration ; les classes d'archivage facturent la relecture et imposent une durée minimale |
| Chiffrement côté serveur | Activé | Sans coût ni contrainte |
| Versions d'objets | Désactivé | La rotation supprime déjà les anciennes sauvegardes ; les versions les garderaient et les factureraient |
| Verrouillage d'objets | Désactivé | Il empêcherait la rotation |
| Accès public | Aucun | Le conteneur reste privé |

Créez ensuite un utilisateur S3 réservé aux sauvegardes, avec le droit de lire et d'écrire dans ce seul conteneur. Notez sa clé d'accès, sa clé secrète, et l'adresse S3 (« endpoint ») de la région.

### 2. Configurer rclone sur le serveur

```bash
sudo -u deploy -H rclone config touch
```

```bash
sudo -u deploy -H nano /home/deploy/.config/rclone/rclone.conf
```

Contenu du fichier, à compléter :

```ini
[learn-backup]
type = s3
provider = Other
endpoint = https://<adresse S3 de la région>
region = <région>
access_key_id = <clé d'accès>
secret_access_key = <clé secrète>
acl = private
```

Le nom `learn-backup` est celui qu'attendent les scripts.

### 3. Nommer le conteneur

Ajoutez à `/srv/learn/.env` :

```
BACKUP_BUCKET=<nom du conteneur>
```

### 4. Vérifier

```bash
sudo -u deploy -H /srv/learn/deploy/backup.sh
```

La commande doit se terminer par « Sauvegarde … envoyée. », et les deux fichiers apparaître dans le conteneur :

```bash
sudo -u deploy -H /srv/learn/deploy/restore.sh
```

## Surveiller

| Besoin | Commande |
|---|---|
| Résultat des dernières nuits | `journalctl -t learn-backup --since "7 days ago"` |
| Sauvegardes présentes | `sudo -u deploy -H /srv/learn/deploy/restore.sh` |
| Lancer une sauvegarde maintenant | `sudo -u deploy -H /srv/learn/deploy/backup.sh` |

Rien n'avertit d'une sauvegarde en échec : un coup d'œil au journal de temps en temps reste nécessaire.

## Limites

- Une sauvegarde par jour : ce qui a été saisi depuis la dernière nuit est perdu en cas d'incident.
- Chaque sauvegarde contient tous les fichiers envoyés : la place occupée vaut environ trente fois leur taille.
- Les sauvegardes ne sont pas chiffrées par l'application ; elles reposent sur le chiffrement et le caractère privé du conteneur.
