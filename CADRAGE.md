# Cadrage — Espace de travail d'études (mini web app auto-hébergée)

Document de référence pour le développement avec Claude Code.
Toute décision listée ici est figée : ne pas la remettre en cause sans demande explicite.

## 1. Besoin

Un espace personnel, mono-utilisateur, pour rassembler les contenus d'études d'ingénieur informatique (CNAM) : cours, fichiers, définitions, et pouvoir retrouver une information rapidement.

Priorité absolue : être utilisable vite. Simplicité avant exhaustivité.

## 2. Contraintes

- Un seul utilisateur. Pas d'inscription, pas de rôles, pas de partage.
- Données hébergées à domicile, sur un petit serveur (Dell Optiplex).
- Application exposée sur Internet en HTTPS : la sécurité fait partie de la V1 (voir section 6).
- Interface en français.
- Utilisation principale sur ordinateur ; lecture correcte sur mobile.

## 3. Stack

| Couche | Choix |
|---|---|
| Front | Angular (dernière version stable) |
| API | NestJS (Node.js, TypeScript) |
| Base | PostgreSQL |
| Accès aux données | ORM avec migrations versionnées |
| Dépôt | Monorepo : `front/`, `api/`, `docker/` |
| Exécution | Docker Compose, identique en local et en production |

Conteneurs : reverse proxy (HTTPS automatique), front (fichiers statiques), API, base.
Seul le reverse proxy est accessible de l'extérieur ; la base n'est jamais exposée.

## 4. Modèle de données

### V1

| Entité | Champs principaux | Notes |
|---|---|---|
| Utilisateur | identifiant, hash du mot de passe | Un seul compte, créé par script d'initialisation |
| UE | code (ex. UTC502), intitulé, description, ordre | Conteneur principal |
| Cours | UE, titre, ordre, contenu (format structuré de l'éditeur), texte brut dérivé pour la recherche, dates de création et de modification | Un cours = un chapitre |
| Image de cours | cours, chemin de stockage, type MIME, taille, texte alternatif | Schémas (SVG, PNG) et captures d'écran ; contenu sur disque |
| Dossier | UE, dossier parent (optionnel), nom | Arborescence par UE |
| Fichier | UE, dossier (optionnel), nom d'origine, chemin de stockage, type MIME, taille | Contenu sur disque, métadonnées en base |
| Terme | type (définition ou acronyme), libellé, forme développée (acronymes), définition (Markdown), UE d'origine (optionnelle), cours d'origine (optionnel) | Commun à toutes les UE |

Dictionnaire et glossaire sont deux écrans sur la même entité Terme, filtrés par type.

### V3 (ne pas développer avant demande)

| Entité | Champs principaux |
|---|---|
| Événement | UE (optionnelle), titre, type (cours ou échéance), début, fin |
| Tâche | UE (optionnelle), titre, échéance, état (fait ou non), date de rappel |

## 5. Décisions fonctionnelles

- **Cours — édition** : éditeur riche de type WYSIWYG, construit sur une bibliothèque d'édition existante (ne pas écrire d'éditeur maison). On édite directement la page telle qu'elle s'affiche, sans syntaxe à connaître.
- **Cours — blocs à gérer** : titres sur trois niveaux (section, sous-section, sous-sous-section), paragraphes, listes, tableaux, blocs de code avec coloration, images avec légende, encadrés typés (« À retenir », « Ce qui a changé », « Attention »), citations, liens.
- **Cours — images** : insertion par collage direct d'une capture d'écran, par glisser-déposer ou par sélection de fichier. Formats PNG, JPEG, SVG. Chaque image est enregistrée comme fichier rattaché au cours ; jamais encodée dans le contenu. Les SVG sont assainis à l'envoi.
- **Cours — lecture** : présentation soignée (largeur de ligne limitée, typographie lisible), sommaire automatique cliquable construit à partir des titres, numérotation des sections conservée telle qu'écrite.
- **Cours — stockage** : contenu dans le format structuré natif de l'éditeur ; une version texte brut est dérivée à chaque enregistrement pour alimenter la recherche.
- **Import** : un cours se crée en déposant un « paquet de cours », archive .zip produite par Claude en même temps que le cours réécrit. Aucun passage par Word. Après import, le cours reste entièrement éditable.
- **Format du paquet de cours** (contrat entre Claude et l'application, à respecter strictement des deux côtés) :
  - `cours.md` : le contenu en Markdown. En-tête de métadonnées : code de l'UE, titre du chapitre, ordre. Titres de niveau 2 à 4 pour sections et sous-sections. Encadrés notés par un marqueur de type en première ligne de citation (`retenir`, `change`, `attention`). Images référencées par chemin relatif, avec légende.
  - `images/` : un fichier par figure (SVG pour les schémas redessinés, PNG ou JPEG pour les figures d'origine et captures), nommé de façon stable (`fig-01.svg`, `fig-02.png`).
  - `termes.json` (optionnel) : les entrées du glossaire du chapitre (type, libellé, forme développée, définition), importées dans les Termes en signalant les doublons au lieu de les écraser.
- **Import — comportement** : aperçu avant validation (titre, nombre de sections, d'images et de termes détectés) ; réimporter un chapitre existant propose de le remplacer ; un paquet invalide est refusé avec un message précis.
- **Import simple** : coller du Markdown seul reste possible pour un contenu sans image.
- **Fichiers** : envoi, téléchargement, renommage, déplacement, suppression, dans une arborescence de dossiers par UE.
- **Termes** : liste alphabétique avec filtre instantané ; création rapide depuis n'importe quel écran.
- **Recherche** : une barre globale, accessible au clavier. Recherche plein texte PostgreSQL en configuration française, insensible aux accents, sur les cours (titre et contenu), les termes et les noms de fichiers. Résultats groupés par type avec extrait surligné.
- **Navigation** : accueil = liste des UE ; page UE = onglets Cours, Fichiers, Termes de l'UE.

## 6. Sécurité (application exposée sur Internet)

- Tout est derrière authentification, sauf la page de connexion.
- Mot de passe haché avec un algorithme actuel (Argon2id).
- Session par cookie HttpOnly, Secure, SameSite strict.
- Limitation du nombre de tentatives de connexion.
- Aucun point d'entrée de création de compte.
- Validation stricte de toutes les entrées de l'API.
- Contenu des cours et SVG assainis contre l'injection de scripts, à l'import comme à l'affichage.
- Fichiers envoyés : taille limitée, stockés hors du répertoire servi, nom de stockage généré, jamais exécutés, servis en téléchargement via l'API authentifiée.
- En-têtes de sécurité HTTP standards.
- Secrets dans des variables d'environnement, jamais dans le dépôt.

## 7. Exploitation

- Sauvegarde automatique quotidienne : export de la base et copie du dossier de fichiers vers un second disque, avec rotation.
- Procédure de restauration documentée et testée une fois.
- Mise à jour : reconstruction des images puis redémarrage par Docker Compose.

## 8. Découpage en tranches

Chaque tranche est livrée de bout en bout (base, API, écran) et validée avant la suivante.

| Tranche | Contenu |
|---|---|
| 0 | Socle : monorepo, Docker Compose, base, migrations, authentification, gabarit de l'interface |
| 1 | UE et cours : liste, lecture, éditeur riche avec images, import d'un paquet de cours |
| 2 | Termes : dictionnaire et glossaire |
| 3 | Recherche globale |
| 4 | Fichiers par UE |
| 5 | Mise en production sur le serveur, HTTPS, sauvegardes |
| Plus tard | Agenda, tâches, rappels par e-mail |

## 9. Hors périmètre

Multi-utilisateur, collaboration, édition simultanée, application mobile native, mode hors ligne, versions des cours, intégration d'IA.
