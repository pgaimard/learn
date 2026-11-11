# Restauration

La restauration **remplace** la base et les fichiers envoyés par ceux d'une sauvegarde. Ce qui a été saisi depuis cette sauvegarde est perdu.

## Restaurer sur le serveur en place

Lister les sauvegardes :

```bash
sudo -u deploy -H /srv/learn/deploy/restore.sh
```

Restaurer l'une d'elles (le script demande de taper « restaurer » avant d'agir) :

```bash
sudo -u deploy -H /srv/learn/deploy/restore.sh 2026-01-31T0315Z
```

Le script arrête l'API, recrée la base à partir de l'export, remet les fichiers, puis redémarre l'application.

Si la sauvegarde date d'avant la version en production, redéployez ensuite cette version : ses migrations mettent le schéma restauré à niveau.

```bash
sudo -u deploy /srv/learn/deploy/deploy.sh v1.2.3
```

## Serveur perdu

1. Préparer un nouveau serveur et y déployer la dernière version : `docs/deploiement.md`, étapes 1 et 2. Le `.env` et ses secrets sont régénérés ; seule conséquence, la session ouverte dans le navigateur n'est plus valable.
2. Refaire la configuration de `rclone` et `BACKUP_BUCKET` : `docs/sauvegarde.md`, étapes 2 et 3.
3. Restaurer la dernière sauvegarde, comme ci-dessus. Le compte et son mot de passe sont dans la sauvegarde : inutile de le recréer.
4. Faire pointer le nom de domaine vers le nouveau serveur.

## Essai de restauration

Le cadrage demande une restauration testée une fois.

| Date | Où | Résultat |
|---|---|---|
| 2026-11-11 | Pile Docker d'essai sur le poste de développement, `rclone` 1.60.1 vers un dossier local | Base, configurations de recherche et fichiers retrouvés à l'identique ; l'API répond après restauration ; une sauvegarde de plus de 30 jours est supprimée par la rotation |

Cet essai ne couvre ni le stockage objet réel ni le serveur. À refaire une fois sur le serveur après la mise en place : créer une UE d'essai, lancer une sauvegarde, supprimer l'UE, restaurer, vérifier qu'elle est revenue, puis compléter ce tableau.
