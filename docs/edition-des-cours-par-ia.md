# Ligne directrice — Accès de l'IA aux données (tranche 8)

Document de travail pour Claude Code. Il détaille la tranche 8 de `CADRAGE.md`. `CADRAGE.md` et
`CLAUDE.md` gardent la priorité : en cas de conflit, s'arrêter et poser la question à Pierre.

## 1. Problème

Un cours entre dans l'application par un paquet `.zip`, et réimporter un chapitre le remplace en
entier. Conséquences :

- toute retouche faite dans l'éditeur est perdue au réimport ;
- revoir un seul passage peu clair oblige à régénérer tout le chapitre ;
- chaque évolution du format oblige à régénérer tous les cours.

## 2. Objectif

Ce qui est enregistré en base devient la source de vérité. Claude, dans une session Cowork, guidé
par le skill `reecriture-cours` et par les consignes de Pierre, lit et modifie les données de
l'application par un serveur MCP, sans paquet à importer :

- créer un cours à partir de documents : le cours, sa fiche de révision, ses exercices, ses
  termes, ses commandes, ses documents sources ;
- corriger l'existant : un passage d'un cours, une répétition entre deux cours, les renvois
  entre cours, un QCM à ajouter, un corrigé reçu du professeur, un outil à compléter.

Deux exigences passent avant tout le reste : ne perdre aucune donnée, et ne jamais écraser une
retouche faite par Pierre.

L'import d'un paquet reste possible.

## 3. État actuel (vérifié dans le code)

| Constat | Où |
|---|---|
| Un cours = un document Tiptap en `jsonb`, plus deux documents frères (fiche, exercices) | `api/src/courses/course.entity.ts` |
| Écriture uniquement par document entier, sans verrou | `PATCH courses/:id`, `courses.service.ts` |
| L'éditeur ne relit pas le contenu après un enregistrement | `front/.../course-edit-page.ts`, `save` |
| Les titres n'ont aucun identifiant ; le marque-page repère une section par son texte | `content-schema.ts`, `bookmark_title` |
| Les exercices ont une clé stable, à laquelle les tentatives sont rattachées | attribut `key`, `exercise_attempts.exercise_key` |
| Conversion Markdown → contenu, et son inverse, qui signale ce que le Markdown perdrait | `import/markdown-to-content.ts`, `content/content-to-markdown.ts` |
| Liste blanche du contenu, partagée par les cours, les termes et les fiches d'outils | `content/validate-content.ts` |
| Contrat du format documenté et testé des deux côtés | `contracts/` |
| Les images qui ne sont plus référencées sont effacées à l'enregistrement | `courses.service.ts`, `update` |
| Termes, outils et commandes s'importent déjà aux formats `termes.json` et `commandes.json` | `import/term-import.ts`, `tools/import/` |
| Sauvegarde nocturne : `pg_dump` et archive des fichiers, restaurés par script | `deploy/backup.sh`, `deploy/restore.sh` |
| Aucun historique, aucun export depuis l'interface | — |
| Authentification par session uniquement | `auth/session.guard.ts` |

## 4. Principes

- La protection d'abord : l'export et les instantanés sont livrés avant toute écriture de l'IA.
- Le serveur MCP est un point d'entrée de l'API : ses outils appellent les services existants,
  sans couche REST intermédiaire ni processus séparé.
- L'IA lit et écrit le Markdown du contrat (`contracts/README.md`) et les formats `termes.json`
  et `commandes.json`, jamais le JSON de l'éditeur. Conversion et validation restent dans l'API.
- Toute écriture passe par la liste blanche existante. Aucun chemin ne la contourne.
- Toute écriture de l'IA est réversible : un instantané est pris avant.
- Une opération ne touche que ce qu'elle vise. Le reste du document est rendu à l'identique.
- Pas de nouvelle table pour les sections : une section est une vue du document.
- La clé d'un exercice existant ne change jamais : les tentatives y sont rattachées.
- L'IA ne supprime ni cours, ni UE, ni fichier, ni tentative, ni exercice ayant des tentatives.

## 5. Découpage

Une étape à la fois, de bout en bout, validée par Pierre avant la suivante. Plan court à
proposer avant chacune.

### 8.1 Export complet

- Écran « Administration » : un bouton télécharge une archive de toute la donnée, l'export de la
  base et les fichiers envoyés, au format de la sauvegarde nocturne.
- `deploy/restore.sh` accepte cette archive. Pas de restauration depuis l'interface.

Fait quand : une archive exportée se restaure sur une base vide et redonne l'application à
l'identique.

### 8.2 Révision des cours et instantanés

- Numéro de révision sur le cours ; toute écriture indique la révision lue, refus (409) si le
  cours a changé. L'éditeur y est soumis aussi.
- Verrou d'édition : l'éditeur déclare le cours « en édition » tant qu'il est ouvert (redit
  toutes les 30 secondes, expire après 2 minutes sans nouvelles). Pendant ce temps, l'IA, le
  remplacement par un paquet et la restauration sont refusés (409), avec un message demandant
  de fermer le cours.
- Table des instantanés d'un cours, pris avant le remplacement d'un chapitre par un paquet et
  avant une restauration, puis avant toute écriture de l'IA (8.4). Ceux des termes, des outils
  et des commandes viennent en 8.5, avec les écritures de l'IA sur ces objets.
- Écran : liste des instantanés d'un objet, restauration.
- Le nettoyage des images tient compte des instantanés.
- Rotation : les dix derniers instantanés de chaque cours.

Fait quand : le remplacement d'un chapitre par un paquet se retrouve dans la liste et se
restaure, images comprises ; deux enregistrements concurrents ne s'écrasent plus.

### 8.3 Serveur MCP en lecture seule

- Outils : lister les UE et les cours, plan d'un document, lire une section ou un document en
  Markdown, lire termes, outils et commandes, rechercher, lire `contracts/README.md`.
- Conversion contenu → Markdown, inverse de `markdown-to-content`. La lecture signale ce que le
  Markdown ne sait pas exprimer (cellules fusionnées, largeurs de colonnes, alignements,
  soulignement) et qu'une réécriture perdrait.

Décisions prises avec Pierre :

1. Cowork se branche par un connecteur personnalisé distant : c'est le cloud d'Anthropic qui
   appelle `https://<domaine>/api/mcp`. Le serveur doit donc être public ; une instance locale
   ne se teste qu'avec un client MCP lancé sur le poste.
2. Authentification par un jeton unique, envoyé dans l'en-tête `X-API-Key` (Claude réserve
   `Authorization` à OAuth et impose une liste de noms), créé (mot de passe redemandé) et révoqué depuis l'écran d'administration. Seule son
   empreinte SHA-256 est en base. Procédure : `docs/connecteur-claude.md`.
3. Dépendances : `@modelcontextprotocol/sdk` et `zod`.
4. Le point d'entrée est sans état, répond en JSON, et n'accepte que POST ; 120 appels par
   minute au plus.

Ordre de livraison : jeton, point d'entrée et deux outils (lister les UE et les cours), puis
mise en production pour l'essai réel ; ensuite la conversion en Markdown, les outils de lecture
des cours, puis ceux des termes, des outils, des commandes et de la recherche. En 8.3, une
section se désigne par son rang dans le plan.

Fait quand : depuis une session Cowork, Claude lit le plan et une section d'un cours réel.

### 8.4 Écritures sur les cours

- Identifiant stable des titres, attribué par l'éditeur à la création et par l'API en filet
  (import, collage, opérations) ; migration des cours existants.
- Outils : créer un cours, poser sa fiche et ses exercices ; remplacer, insérer, supprimer une
  section ; ajouter un exercice ou un QCM ; poser ou remplacer le corrigé d'un exercice désigné
  par sa clé ; envoyer une image SVG.
- Messages d'erreur de validation précis : l'IA s'en sert pour se corriger.
- Texte de recherche recalculé, images vérifiées, instantané pris, le tout dans une transaction.

Fait quand : remplacer une section laisse le reste du document identique ; tests d'intégration
pour le cas nominal, l'entrée invalide, le conflit de révision et l'accès non authentifié.

### 8.5 Écritures sur les termes, les outils et les commandes

- Outils calqués sur les imports existants, aux formats `termes.json` et `commandes.json`, avec
  les mêmes règles de doublons.

Fait quand : une définition et une commande modifiées par l'IA se retrouvent dans les
instantanés et se restaurent.

### 8.6 Documents sources

Un outil MCP ne reçoit que ce que le modèle écrit : un PDF ou une capture ne peuvent pas y
passer. Selon ce que Cowork permet : envoi par Claude vers une adresse à usage unique fournie
par un outil, ou dépôt par Pierre dans le dossier du cours. À trancher avec lui.

## 6. Sécurité

`CADRAGE.md` § 6 s'applique sans exception.

- Ce que l'IA envoie est une entrée hostile comme une autre : même liste blanche, même
  assainissement des SVG.
- Le texte des documents sources peut contenir des instructions adressées à l'IA. Comme elle a
  la main sur toute la donnée, la protection est la réversibilité (instantanés, export) et
  l'absence d'outils de suppression lourde, de compte, de configuration et d'export.
- Le secret de l'accès n'est jamais dans le dépôt ni dans les journaux.

## 7. Hors périmètre de cette tranche

Prévu ensuite (`CADRAGE.md` § 8, « Plus tard »), en s'appuyant sur les mêmes services :

- assistant intégré à l'application, par l'API de Claude ;
- question posée depuis un cours ;
- aide à la réalisation des exercices.

Ne rien anticiper.

## 8. Le skill

Le skill `reecriture-cours` vit hors du dépôt : Pierre le fait évoluer lui-même. Il sera adapté
pour appeler les outils au lieu de produire un paquet. Rien à faire ici, sinon garder
`contracts/README.md` exact : c'est sa référence.
