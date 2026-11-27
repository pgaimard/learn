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
| Cours | UE, titre, ordre, contenu (format structuré de l'éditeur), texte brut dérivé pour la recherche, fiche de révision (optionnelle, même format que le contenu), marque-page de lecture (optionnel), dates de création et de modification | Un cours = un chapitre |
| Image de cours | cours, chemin de stockage, type MIME, taille, texte alternatif | Schémas (SVG, PNG) et captures d'écran ; contenu sur disque |
| Dossier | UE, dossier parent (optionnel), nom, cours (optionnel) | Arborescence par UE ; chaque cours a son dossier, à la racine de l'UE |
| Fichier | UE, dossier (optionnel), nom d'origine, chemin de stockage, type MIME, taille | Contenu sur disque, métadonnées en base |
| Terme | type (définition ou acronyme), libellé, forme développée (acronymes), définition (format structuré de l'éditeur, comme un cours), texte brut dérivé pour la recherche, UE, cours d'origine (optionnel) | Appartient à une UE ; libellé unique par UE et par type |
| Image de terme | terme, chemin de stockage, type MIME, taille, texte alternatif | Mêmes règles que les images de cours |
| Tentative d'exercice | cours, clé de l'exercice ou du QCM, genre (exercice ou QCM), réponse (format structuré de l'éditeur ; aucune pour un QCM), note et barème, date de validation | Sans date de validation, c'est le brouillon en cours : un au plus par exercice. Supprimée avec le cours |

Définitions et acronymes sont la même entité Terme, distinguée par son type. Il n'y a pas de dictionnaire ni de glossaire commun : les termes se consultent dans l'onglet Termes de leur UE, où un filtre sépare les deux types.

### Agenda et tâches (tranche 6)

| Entité | Champs principaux |
|---|---|
| Événement | UE (optionnelle), titre, type (cours ou échéance), début, fin |
| Tâche | UE (optionnelle), titre, échéance, état (fait ou non), date de rappel |

Les rappels par e-mail ne sont pas à développer avant demande.

### Outils et commandes (tranche 7)

| Entité | Champs principaux | Notes |
|---|---|---|
| Outil | nom, phrase de présentation, fonctionnement (format structuré de l'éditeur, comme un cours), texte brut dérivé pour la recherche, UE où il sert (zéro, une ou plusieurs) | Ce que l'on apprend à utiliser : bash, PowerShell, Cisco IOS, git, npm |
| Mode d'outil | outil, nom, invite, façon d'y entrer, ordre | Facultatif : modes d'un terminal (Cisco IOS) |
| Déclinaison d'outil | outil, nom, ordre | Facultatif : variantes d'un même outil (bash et zsh pour « Shell Unix ») |
| Commande | outil, nom, phrase de description, syntaxe, mode requis (facultatif), déclinaisons concernées (aucune = toutes), notes, thèmes (étiquettes libres), UE et cours où elle sert | Une commande appartient à un seul outil ; son nom y est unique |
| Option de commande | commande, texte, description, déclinaisons concernées (aucune = toutes), ordre | |
| Exemple de commande | commande, ligne de commande, explication, sortie (facultative), ordre | |

## 5. Décisions fonctionnelles

- **Cours — édition** : éditeur riche de type WYSIWYG, construit sur une bibliothèque d'édition existante (ne pas écrire d'éditeur maison). On édite directement la page telle qu'elle s'affiche, sans syntaxe à connaître.
- **Cours — blocs à gérer** : titres sur quatre niveaux (section, sous-section, sous-sous-section, point), paragraphes, listes, tableaux, blocs de code avec coloration, images avec légende, encadrés typés (« À retenir », « Ce qui a changé », « Attention », « Définition », « À savoir », « À noter », « Astuce »), citations, liens, diaporamas (suite d'étapes faites d'une image et de son explication), QCM (questions à choix avec leurs bonnes réponses et leur explication), exercices (énoncé et corrigé). Paragraphes et titres s'alignent à gauche (par défaut), au centre, à droite ou se justifient. La barre de l'éditeur a deux lignes : en haut ce qu'on édite (UE, titre) et ses actions (Terminer, Enregistrer, supprimer) ; en dessous les outils, dans l'ordre texte, alignement, listes, insertion, historique.
- **Cours — images** : insertion par collage direct d'une capture d'écran, par glisser-déposer ou par sélection de fichier. Formats PNG, JPEG, SVG. Chaque image est enregistrée comme fichier rattaché au cours ; jamais encodée dans le contenu. Les SVG sont assainis à l'envoi.
- **Cours — lecture** : présentation soignée (largeur de ligne limitée, typographie lisible), sommaire automatique cliquable construit à partir des titres, numérotation des sections conservée telle qu'écrite. Sur grand écran, trois colonnes : à gauche le fil d'Ariane, le titre et le sommaire, qui suit la lecture ; au centre le cours, qui défile avec la page ; à droite les actions, les termes et les commandes du chapitre. Les colonnes latérales restent en place pendant la lecture.
- **Cours — marque-page** : en lecture, un clic droit dans une section propose « Marquer ma page ». Le marque-page, un par cours, est enregistré en base sur le titre de la section ; un point vert le signale devant ce titre, dans le sommaire et devant le cours dans la liste de l'UE. Quand la lecture quitte la section marquée, un bouton « Revenir à ma page » y ramène ; après un renvoi vers une section, « Revenir à ma lecture » passe avant. À la réouverture, le cours s'affiche à cet endroit.
- **Cours — fiche de révision** : chaque cours peut avoir une fiche de révision rédigée, second document au même format que le cours (texte, schémas, tableaux, encadrés). En lecture, un bouton l'affiche à la place du cours, avec son propre sommaire. Elle se rédige et se modifie avec l'éditeur des cours, et s'importe par le paquet.
- **Cours — diaporama** : pour suivre un déroulement image par image. En lecture, il apparaît par sa première image ; un clic ouvre une fenêtre où l'on passe d'une étape à l'autre (boutons ou flèches du clavier), l'explication sous l'image. En édition, ses étapes s'affichent l'une sous l'autre et se modifient comme le reste : image, titre d'étape, explication, ordre. Soixante étapes au plus ; il ne se place qu'au premier niveau du cours.
- **Cours — QCM** : pour s'exercer dans le cours. En lecture, chaque question montre ses choix avec des cases à cocher, sans indiquer combien sont justes ; « Valider » corrige toutes les questions, signale les bonnes et les mauvaises réponses et affiche l'explication de chacune ; « Recommencer » efface les réponses. Les réponses elles-mêmes ne sont pas enregistrées, mais le score de chaque validation l'est : « Historique » en donne la liste, datée. Un QCM est désigné par son rang parmi ceux du cours. En édition, on rédige l'énoncé, les choix et l'explication de chaque question et on coche les bonnes réponses ; l'explication accepte les blocs du cours (tableaux, code, images, encadrés), sauf les titres. Cinquante questions au plus, de deux à dix choix par question ; il ne se place qu'au premier niveau du cours.
- **Cours — exercice** : un bloc fait d'un titre, d'un énoncé et d'un corrigé, qui acceptent les blocs du cours sauf les titres. En lecture, le cours montre l'énoncé ; « Faire l'exercice » ouvre une fenêtre plein écran, l'énoncé à gauche, la réponse à droite, saisie avec l'éditeur des cours (texte, tableaux, grilles à cocher, code ; pas d'image). « Valider » fige la réponse et affiche le corrigé à côté d'elle ; on peut la reprendre. Le brouillon de la réponse s'enregistre au fil de la saisie et se retrouve à la réouverture. Une réponse validée devient une tentative, que l'on note soi-même sur 20, au demi-point ; un historique par exercice permet de rouvrir une ancienne tentative avec son corrigé, et de repartir d'elle. En édition, on rédige l'énoncé et le corrigé l'un sous l'autre. L'exercice ne se place qu'au premier niveau du cours.
- **Cours — tableaux** : à la création, on choisit le nombre de lignes et de colonnes (d'un geste sur une grille ou par saisie) et les en-têtes, ligne et colonne. En édition, un bouton « + » sous le tableau ajoute une ligne et un autre à sa droite ajoute une colonne ; des poignées déplacent lignes et colonnes ; le clic droit insère, supprime, bascule les en-têtes, fusionne les cellules sélectionnées en glissant de l'une à l'autre, scinde une cellule fusionnée. Dans un tableau, un menu de la barre d'outils, voisin de celui de l'alignement du texte, aligne le contenu d'une cellule en haut (par défaut), au milieu ou en bas.
- **Cours — grille à cocher** : un tableau dont la première ligne et la première colonne sont des en-têtes et dont les autres cellules sont des cases, remplies de couleur ou vides, pour les chronogrammes et les matrices. On la crée depuis le panneau du tableau en donnant les noms des lignes et des colonnes (des libellés, ou une plage de nombres) ; en édition, un clic sur une case la remplit ou la vide ; en lecture, elle s'affiche telle quelle. Lignes et colonnes s'ajoutent comme dans tout tableau.
- **Cours — stockage** : contenu dans le format structuré natif de l'éditeur ; une version texte brut est dérivée à chaque enregistrement pour alimenter la recherche.
- **Import** : un cours se crée en déposant un « paquet de cours », archive .zip produite par Claude en même temps que le cours réécrit. Aucun passage par Word. Après import, le cours reste entièrement éditable.
- **Format du paquet de cours** (contrat entre Claude et l'application, à respecter strictement des deux côtés) :
  - `cours.md` : le contenu en Markdown. En-tête de métadonnées : code de l'UE, titre du chapitre, ordre. Titres de niveau 2 à 5 pour sections et sous-sections. Encadrés notés par un marqueur de type en première ligne de citation (`retenir`, `change`, `attention`, `definition`, `savoir`, `noter`, `astuce`). Images référencées par chemin relatif, avec légende. Diaporamas notés comme un encadré de marqueur `diaporama` : chaque image y ouvre une étape, le texte qui la suit l'explique. QCM notés comme un encadré de marqueur `qcm` : une liste numérotée de questions, chacune avec ses choix précédés de `[x]` (bonne réponse) ou `[ ]`, puis son explication. Grille à cocher notée comme un tableau dont le corps, hors première colonne, n'est fait que de cases `[x]` ou `[ ]`. Exercice noté comme un encadré de marqueur `exercice`, son corrigé dans un encadré `corrige` imbriqué en dernier.
  - `fiche.md` (optionnel) : la fiche de révision du chapitre, en Markdown sans en-tête, avec les mêmes constructions que `cours.md` ; ses images sont des fichiers du dossier `images/`. Un paquet sans `fiche.md` garde la fiche déjà en place.
  - `images/` : un fichier par figure (SVG pour les schémas redessinés, PNG ou JPEG pour les figures d'origine et captures), nommé de façon stable (`fig-01.svg`, `fig-02.png`).
  - `termes.json` (optionnel) : les entrées du glossaire du chapitre (type, libellé, forme développée, définition en Markdown, dont les images sont des fichiers du dossier `images/`), importées dans les Termes de l'UE du chapitre en signalant les doublons de cette UE : ils sont laissés tels quels, ou leur définition est remplacée si l'import le demande.
  - `sources/` (optionnel) : les documents qui ont servi à rédiger le cours (supports d'origine, sujets, annexes), sans sous-dossier. L'import les range dans le dossier de fichiers du cours ; au réimport, un document de même nom est remplacé et les autres sont gardés.
  - `commandes.json` (optionnel) : les outils et les commandes appris dans le chapitre (outil avec présentation, fonctionnement en Markdown sans image, modes et déclinaisons ; commandes avec syntaxe, mode, déclinaisons, thèmes, notes, options et exemples). Les outils absents sont créés ; un outil déjà présent ne reçoit que les modes et déclinaisons qui lui manquent. Les commandes sont rattachées au chapitre importé ; les doublons sont laissés tels quels, ou remplacés si l'import le demande. Le même fichier s'importe aussi seul, depuis la page des outils.
- **Import — comportement** : aperçu avant validation (titre, nombre de sections, d'images, de termes et de documents sources détectés) ; réimporter un chapitre existant propose de le remplacer ; une case à cocher propose de remplacer la définition des termes déjà présents ; l'aperçu annonce aussi les outils et les commandes détectés, avec une case à cocher pour remplacer les commandes déjà présentes ; un paquet invalide est refusé avec un message précis.
- **Import simple** : coller du Markdown seul reste possible pour un contenu sans image.
- **Fichiers** : envoi, téléchargement, renommage, déplacement, suppression, dans une arborescence de dossiers par UE. Chaque cours a un dossier à son nom, créé avec lui : il suit son titre et ne se renomme, ne se déplace ni ne se supprime à la main. À la suppression du cours, un dossier vide disparaît avec lui ; s'il contient des fichiers, l'application demande s'il faut les supprimer ou garder le dossier comme dossier ordinaire.
- **Termes** : dans chaque UE, liste alphabétique avec filtre instantané et création rapide depuis l'onglet Termes. Le même libellé peut exister dans deux UE. Dans un cours, seuls les termes de son UE sont reconnus dans le texte. Une définition s'édite comme un mini-cours, avec l'éditeur et les blocs des cours (code, images, tableaux, encadrés).
- **Recherche** : une barre globale, accessible au clavier. Recherche plein texte PostgreSQL en configuration française, insensible aux accents, sur les cours (titre et contenu), les termes, les noms de fichiers, les outils et les commandes. Résultats groupés par type avec extrait surligné.
- **Tâches** : liste à cocher, filtrable par UE ; les tâches faites sont gardées et masquées par défaut. Sans e-mail, la date de rappel fait apparaître la tâche dans un encart « À faire maintenant » et dans une pastille de l'en-tête.
- **Agenda** : une semaine à la fois, les jours en liste. Un événement peut être répété chaque semaine jusqu'à une date : chaque occurrence est ensuite un événement indépendant. Les tâches apparaissent à la date de leur échéance.
- **Outils et commandes** : on entre par l'outil. Sa page a deux volets : « Fonctionnement » (la fiche rédigée et, s'il en a, ses modes) et « Commandes » (la liste, avec une recherche sur le nom et la description et des filtres par thème, par mode et par déclinaison). Une même commande existe autant de fois qu'il y a d'outils où elle sert (`ping` dans bash, dans PowerShell, dans Cisco IOS) ; sa fiche renvoie aux commandes de même nom des autres outils. Une commande ou une option qui n'existe que dans certaines déclinaisons de l'outil le signale par une pastille ; sans pastille, elle vaut pour toutes. La fiche d'une commande est colorée (nom, options, arguments) et ses exemples se copient. Seules les commandes apprises sont saisies : la liste n'a pas vocation à être exhaustive. Outils et commandes s'importent aussi par le paquet produit par Claude.
- **Navigation** : accueil = liste des UE ; page UE = onglets Cours, Fichiers, Termes de l'UE, Commandes de l'UE (celles étiquetées avec l'UE ou un de ses cours, rangées par outil) ; page d'un cours = ses termes et ses commandes en marge ; l'agenda, les tâches et les outils ont chacun leur écran ; l'agenda et les tâches ont un filtre par UE.

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
| 6 | Agenda et tâches |
| 7 | Outils et commandes : outils avec fonctionnement, modes et déclinaisons ; commandes avec options et exemples ; liens vers les UE et les cours ; recherche ; import |
| Plus tard | Rappels par e-mail |

## 9. Hors périmètre

Multi-utilisateur, collaboration, édition simultanée, application mobile native, mode hors ligne, versions des cours, intégration d'IA.
