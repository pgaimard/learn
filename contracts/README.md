# Contrats partagés

## Contenu d'un cours

`course-content.example.json` est un cours d'exemple qui utilise tous les blocs, marques et attributs
produits par l'éditeur. Il est testé des deux côtés :

- le front vérifie que l'éditeur le relit et le réécrit à l'identique (`course-extensions.spec.ts`) ;
- l'API vérifie que sa liste blanche l'accepte (`validate-content.spec.ts`).

Ajouter un bloc à l'éditeur impose donc de l'ajouter ici, puis à la liste blanche de l'API.

L'attribut `pinned` (paragraphe, listes, citation, bloc de code, tableau, image, encadré) date de
l'ancienne fiche de révision, calculée à partir des blocs épinglés. Il n'a plus d'effet, mais reste
accepté : les cours déjà enregistrés le portent. La fiche de révision est désormais un document
rédigé à part (voir « Fiche de révision »).

## Paquet de cours

Un paquet de cours est une archive `.zip` qui contient :

- `cours.md` : le cours en Markdown, dont `cours.example.md` montre toutes les constructions acceptées ;
- `images/` : un fichier par figure du cours (`fig-01.svg`, `fig-02.png`…) ou d'une définition
  (`def-commutation-01.svg`…), en SVG, PNG ou JPEG ;
- `fiche.md` (facultatif) : la fiche de révision du chapitre (voir « Fiche de révision ») ;
- `termes.json` (facultatif) : les termes du chapitre (définitions et acronymes), rangés dans
  l'UE du chapitre.
- `commandes.json` (facultatif) : les outils et les commandes appris dans le chapitre (voir
  « Outils et commandes »).
- `sources/` (facultatif) : les documents qui ont servi à rédiger le cours (voir « Documents
  sources »).

Règles de `cours.md` :

- un en-tête entre deux lignes `---`, avec `ue` (code de l'UE), `titre` et `ordre` ;
- le chapitre est reconnu par son `titre` dans l'UE, sans tenir compte de la casse : réimporter
  un paquet de même titre propose de remplacer le chapitre, qui garde sa place ;
- `ordre` ne sert qu'à placer un nouveau chapitre : il prend ce rang parmi ceux de l'UE (la fin
  si le rang dépasse leur nombre) et les suivants reculent. L'ordre se change ensuite en faisant
  glisser les cours dans la liste ;
- des titres de niveau 2 à 5 (`##` à `#####`) ; le niveau 1 est réservé au titre du chapitre ;
- un encadré est une citation dont la première ligne est `[!retenir]`, `[!change]`, `[!attention]`
  ou `[!definition]` (voir « Encadrés ») ;
- une image est seule dans son paragraphe : `![texte alternatif](images/fig-01.svg "Légende")` ;
- le HTML n'est pas interprété : il reste du texte.

### Encadrés

| Marqueur | Libellé affiché | À utiliser pour |
|---|---|---|
| `[!retenir]` | À retenir | L'essentiel d'une section, ce qu'il faut savoir par cœur. |
| `[!change]` | Ce qui a changé | Une évolution par rapport au support d'origine ou à une ancienne pratique. |
| `[!attention]` | Attention | Un piège, une confusion fréquente, une erreur à éviter. |
| `[!definition]` | Définition | La définition d'une notion, à l'endroit où le cours l'introduit. |

```markdown
> [!definition]
> Un **processus** est un programme en cours d'exécution, avec son contexte.
```

- le libellé (« Définition ») est affiché par l'application : il ne s'écrit pas dans l'encadré ;
- un encadré « Définition » pose la notion dans le fil du cours ; il ne crée pas d'entrée dans les
  termes de l'UE. La notion qui mérite d'y figurer est aussi listée dans `termes.json` ;
- le terme défini s'écrit en gras à sa première mention dans l'encadré.

### Fiche de révision

`fiche.md` est la fiche de révision du chapitre : un document à part, rédigé pour réviser, et non
un extrait du cours. `fiche.example.md` en montre la forme.

- pas d'en-tête : le fichier commence directement par son contenu ; la fiche est rattachée au
  chapitre de `cours.md` ;
- mêmes constructions que `cours.md` : titres de niveau 2 à 5, paragraphes, listes, tableaux, blocs
  de code, citations, encadrés (`[!retenir]`, `[!change]`, `[!attention]`, `[!definition]`),
  images ;
- une image s'écrit comme dans le cours, seule dans son paragraphe, et son fichier est dans le
  dossier `images/` du paquet : `![Texte alternatif](images/fiche-01.svg "Légende")`. Le préfixe
  `fiche-` évite toute collision avec les figures du cours ; un même fichier peut servir au cours
  et à la fiche ;
- la fiche a ses propres titres et son propre sommaire : elle ne reprend pas forcément le plan du
  cours. Elle va à l'essentiel — définitions, schémas de synthèse, tableaux comparatifs, méthodes,
  pièges — sans renvoyer au cours pour être comprise ;
- un `fiche.md` vide, invalide, ou qui référence une image absente fait refuser tout le paquet.

Ce que fait l'import :

- un paquet avec `fiche.md` crée la fiche du chapitre, ou remplace celle qui existe (ses anciennes
  images sont supprimées) ;
- un paquet sans `fiche.md` ne touche pas à la fiche du chapitre : réimporter le cours seul garde
  la fiche déjà en place ;
- la fiche se relit par le bouton « Fiche de révision » du cours et se retouche dans l'application,
  avec le même éditeur que le cours ;
- le Markdown collé, sans paquet, ne transporte pas de fiche.

`fiche.example.md` est importé par les tests de l'API (`course-imports.e2e-spec.ts`).

### Documents sources

Chaque cours a, dans les fichiers de son UE, un dossier à son nom. Le paquet y dépose les
documents qui ont servi à rédiger le cours : supports fournis (PDF, diaporama, document Word),
sujets, annexes. Ils y restent consultables à côté du cours réécrit.

- Les placer dans le dossier `sources/` du paquet, directement dedans : un sous-dossier fait
  refuser le paquet.
- Y mettre les documents d'origine tels qu'ils ont été fournis, sous leur nom d'origine, sans les
  convertir ni les renommer. Ne pas y remettre `cours.md`, `fiche.md` ni les figures de `images/`.
- Un nom de fichier ne contient ni « / », ni « \ », ni caractère de contrôle, et fait 255
  caractères au plus. Tous les formats sont acceptés : un document source n'est jamais affiché
  ni exécuté par l'application, seulement téléchargé.
- Le paquet entier, sources comprises, fait 50 Mo au plus une fois décompressé et 500 fichiers
  au plus. Un support trop lourd est laissé hors du paquet, à déposer à la main dans le dossier
  du cours.
- Au réimport d'un chapitre, un document de même nom (sans tenir compte de la casse) est
  remplacé ; les autres documents du dossier sont gardés, y compris ceux déposés à la main.
- Le dossier porte le titre du chapitre (`titre` de l'en-tête) : il est créé à l'import et suit
  le titre si le cours est renommé. Il n'y a rien à déclarer dans `cours.md`.

### Renvois vers une section

En lecture, l'application rend cliquable un renvoi vers une section du même cours. Il n'y a
aucune syntaxe à écrire : il suffit de rédiger le renvoi comme ci-dessous.

- Les titres portent leur numéro au début de leur texte : `## 3. Ordonnancement`,
  `### 3.4 Tourniquet`. Un titre sans numéro ne peut pas être la cible d'un renvoi.
- Dans le texte, le numéro est précédé de l'un de ces mots : « section », « § », « partie »,
  « chapitre », « voir », « cf. », « réf. » (au singulier ou au pluriel, avec ou sans majuscule).
  Exemples : « voir section 3.4 », « cf. 3.4 », « (réf. 3.4) », « § 3.4 », « sections 3.4 et 3.5 ».
- Le numéro cité est exactement celui du titre : « 3.4 » mène au titre qui commence par « 3.4 ».
  S'il ne correspond à aucun titre du cours, le texte reste du texte.
- Un numéro sans l'un de ces mots devant lui n'est pas un renvoi (« 3.4 GHz », « version 2.1 »).
  Rien n'est reconnu dans les titres ni dans le code.
- Un renvoi ne désigne qu'une section du même cours. Pour citer un autre chapitre, écrire son
  titre plutôt que « chapitre 3 », qui mènerait à la section 3 du cours en cours de lecture.

### Termes cliquables dans le texte

En lecture, l'application rend cliquable, dans le texte du cours, chaque terme de l'UE du
cours : un clic ouvre sa définition complète. Il n'y a aucune syntaxe à écrire, et le terme n'a
pas besoin de venir du même paquet : il suffit qu'il appartienne à la même UE. Un terme d'une
autre UE n'est pas reconnu.

- Le terme est reconnu par son `libelle`, en mot entier : écrire dans le cours le libellé tel
  qu'il figure dans `termes.json`. « processus » est reconnu pour le libellé « Processus » ;
  un pluriel ou une autre forme (« ordonnanceurs » pour « Ordonnanceur ») ne l'est pas.
- Une définition est reconnue sans tenir compte des majuscules ; un acronyme l'est avec ses
  majuscules exactes (« PCB », pas « pcb »).
- Quand deux libellés se recouvrent, le plus long l'emporte (« commutation de contexte » plutôt
  que « contexte »).
- Rien n'est reconnu dans les titres ni dans le code.

### Les termes appartiennent à l'UE du chapitre

Il n'y a pas de dictionnaire ni de glossaire commun à toutes les UE : chaque terme appartient à
une UE, celle du `ue` de l'en-tête de `cours.md`. Le même libellé peut donc exister dans deux UE
avec deux définitions différentes (« PID » en systèmes et en automatique).

- Rédiger chaque définition pour l'UE du chapitre, sans chercher à couvrir le sens que le terme
  a dans une autre matière.
- Lister dans `termes.json` tout terme utile au chapitre, même s'il a déjà été défini dans le
  paquet d'une autre UE : il n'y est pas visible depuis celle-ci.
- Un terme déjà défini dans un autre chapitre de la même UE n'a pas à être répété : il est
  reconnu dans le texte, et le répéter le signalerait comme doublon.

Règles de `termes.json`, dont `termes.example.json` montre les quatre formes d'entrée
(définition, acronyme défini, acronyme seul, définition riche) :

- une liste de 500 entrées au plus, chacune avec `type` (`definition` ou `acronyme`) et `libelle` ;
- `forme_developpee` est obligatoire pour un acronyme et interdite pour une définition ;
- `definition` est du Markdown de 10 000 caractères au plus, avec les mêmes constructions que
  `cours.md`, images comprises ; elle est obligatoire pour une définition, facultative pour un
  acronyme ;
- toute autre clé est refusée, ainsi que deux entrées de même type et de même libellé ;
- un terme déjà présent dans l'UE du chapitre (même type, même libellé sans tenir compte de la
  casse) est signalé à l'aperçu. Par défaut il est laissé tel quel ; en cochant « Remplacer leur
  définition par celle du paquet », sa définition, sa forme développée et ses images sont
  remplacées par celles du paquet, et il est rattaché au cours importé. Son libellé ne change pas.

### Définition riche

Une définition (ou la définition d'un acronyme) peut être un mini-cours : paragraphes, listes,
tableaux, blocs de code, citations, encadrés `[!retenir]`, `[!change]`, `[!attention]`, `[!definition]`, titres de
niveau 2 à 5, et images. Dans le JSON, les sauts de ligne du Markdown s'écrivent `\n` et un bloc
est séparé du suivant par une ligne vide (`\n\n`).

Un schéma ou une image s'insère comme dans `cours.md` :

```markdown
![Texte alternatif](images/def-commutation-01.svg "Légende facultative")
```

- l'image est seule dans son paragraphe ;
- son fichier est dans le dossier `images/` du paquet, avec ceux du cours. Le nom est libre
  (lettres sans accent, chiffres, `.`, `_`, `-`) ; le préfixe `def-` suivi du terme évite toute
  collision avec les figures du cours ;
- formats SVG, PNG ou JPEG, 5 Mo au plus par image ; un SVG est assaini à l'import (scripts et
  contenus externes retirés) ;
- une image référencée mais absente du paquet, ou d'un format refusé, fait refuser tout le paquet
  avec un message qui nomme le terme et le fichier ;
- un même fichier peut servir au cours et à une ou plusieurs définitions : chacun en reçoit sa copie ;
- les images d'un terme déjà présent dans l'application ne sont importées que si l'on demande le
  remplacement de sa définition ; ses anciennes images sont alors supprimées.

Un paquet sans image de définition reste valide : rien n'est à changer dans les paquets existants.
Le Markdown collé, sans paquet, ne transporte toujours ni image ni terme.

`termes.example.json` est lu par les tests de l'API (`parse-terms.spec.ts`,
`course-imports.e2e-spec.ts`).

`cours.example.md` est importé par les tests de l'API (`markdown-to-content.spec.ts`,
`course-imports.e2e-spec.ts`).

## Outils et commandes

`commandes.json` décrit les outils (bash, Cisco IOS, git…) et les commandes apprises. Il s'importe
de deux façons :

- dans un paquet de cours, à côté de `cours.md` : ses commandes sont rattachées au chapitre importé ;
- seul, par le bouton « Importer » de la page Outils : rien n'est rattaché à un cours.

`commandes.example.json` montre toutes les clés acceptées. Le fichier est une liste d'outils :

| Clé d'un outil | Rôle |
|---|---|
| `outil` | Nom de l'outil, requis (100 caractères au plus). |
| `presentation` | Une phrase (300 caractères au plus). |
| `fonctionnement` | Fiche en Markdown, comme un cours (titres `##` à `#####`, listes, tableaux, code, encadrés), **sans image**, 20 000 caractères au plus. |
| `modes` | Liste de `{ "nom", "invite", "entree" }` : modes d'un terminal, dans l'ordre où on les traverse. |
| `declinaisons` | Liste de noms : variantes de l'outil (`"bash"`, `"zsh"`). |
| `commandes` | Liste des commandes (300 au plus). |

| Clé d'une commande | Rôle |
|---|---|
| `nom` | Requis, unique dans l'outil sans tenir compte de la casse (`"ping"`, `"show ip route"`). |
| `description` | Une phrase (300 caractères au plus). |
| `syntaxe` | Forme générale : entre crochets ce qui est facultatif, entre chevrons ce qu'il faut fournir (`ping [-c <nombre>] <hôte>`). |
| `mode` | Nom d'un des `modes` de l'outil où la commande se tape. |
| `declinaisons` | Déclinaisons où la commande existe ; absent : toutes. |
| `themes` | Étiquettes libres (10 au plus, 40 caractères chacune). |
| `notes` | Texte libre (5 000 caractères au plus). |
| `options` | Liste de `{ "texte", "description", "declinaisons" }` ; seul `texte` est requis. |
| `exemples` | Liste de `{ "ligne", "explication", "sortie" }` ; seule `ligne` est requise. `sortie` est ce que le terminal répond. |

Règles :

- un `mode` ou une déclinaison cités par une commande ou une option doivent être déclarés dans
  `modes` et `declinaisons` du même outil, même si l'outil existe déjà dans l'application ;
- une clé inconnue, un nom en double (outil dans le fichier, commande dans l'outil) ou un texte
  trop long font refuser tout le fichier — et tout le paquet de cours qui le contient — avec un
  message qui dit où : `commandes.json, outil 1, commande 2 : « nom » est requis.` ;
- la coloration (nom, options, valeurs à fournir) est calculée à l'affichage : le fichier ne
  contient que du texte.

Ce que fait l'import :

- un outil est reconnu par son nom, sans tenir compte de la casse. Absent, il est créé avec sa
  présentation, sa fiche, ses modes et ses déclinaisons. Déjà présent, sa présentation et sa fiche
  ne sont pas touchées ; seuls les modes et les déclinaisons qui lui manquent sont ajoutés ;
- une commande est reconnue par son nom dans son outil. Absente, elle est créée. Déjà présente,
  elle est laissée telle quelle, ou remplacée par celle du fichier si l'import le demande (case à
  cocher de l'aperçu) ; elle garde alors ses UE et ses cours ;
- dans un paquet de cours, toutes les commandes du fichier, nouvelles ou déjà présentes, sont
  rattachées au chapitre importé.

`commandes.example.json` est lu par les tests de l'API (`parse-commands.spec.ts`,
`command-imports.e2e-spec.ts`).
