# Contrats partagés

## Contenu d'un cours

`course-content.example.json` est un cours d'exemple qui utilise tous les blocs, marques et attributs
produits par l'éditeur. Il est testé des deux côtés :

- le front vérifie que l'éditeur le relit et le réécrit à l'identique (`course-extensions.spec.ts`) ;
- l'API vérifie que sa liste blanche l'accepte (`validate-content.spec.ts`).

Ajouter un bloc à l'éditeur impose donc de l'ajouter ici, puis à la liste blanche de l'API.

L'attribut `pinned` (paragraphe, listes, citation, bloc de code, tableau, image, encadré) marque
un bloc comme épinglé à la fiche de révision du cours. Il est facultatif : un contenu importé ou
plus ancien qui ne le porte pas reste valide, et le bloc n'est alors pas épinglé.

## Paquet de cours

Un paquet de cours est une archive `.zip` qui contient :

- `cours.md` : le cours en Markdown, dont `cours.example.md` montre toutes les constructions acceptées ;
- `images/` : un fichier par figure du cours (`fig-01.svg`, `fig-02.png`…) ou d'une définition
  (`def-commutation-01.svg`…), en SVG, PNG ou JPEG ;
- `termes.json` (facultatif) : la liste des entrées du glossaire du chapitre.

Règles de `cours.md` :

- un en-tête entre deux lignes `---`, avec `ue` (code de l'UE), `titre` et `ordre` ;
- le chapitre est reconnu par son `titre` dans l'UE, sans tenir compte de la casse : réimporter
  un paquet de même titre propose de remplacer le chapitre, qui garde sa place ;
- `ordre` ne sert qu'à placer un nouveau chapitre : il prend ce rang parmi ceux de l'UE (la fin
  si le rang dépasse leur nombre) et les suivants reculent. L'ordre se change ensuite en faisant
  glisser les cours dans la liste ;
- des titres de niveau 2 à 5 (`##` à `#####`) ; le niveau 1 est réservé au titre du chapitre ;
- un encadré est une citation dont la première ligne est `[!retenir]`, `[!change]` ou `[!attention]` ;
- une image est seule dans son paragraphe : `![texte alternatif](images/fig-01.svg "Légende")` ;
- le HTML n'est pas interprété : il reste du texte.

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

Règles de `termes.json`, dont `termes.example.json` montre les quatre formes d'entrée
(définition, acronyme défini, acronyme seul, définition riche) :

- une liste de 500 entrées au plus, chacune avec `type` (`definition` ou `acronyme`) et `libelle` ;
- `forme_developpee` est obligatoire pour un acronyme et interdite pour une définition ;
- `definition` est du Markdown de 10 000 caractères au plus, avec les mêmes constructions que
  `cours.md`, images comprises ; elle est obligatoire pour une définition, facultative pour un
  acronyme ;
- toute autre clé est refusée, ainsi que deux entrées de même type et de même libellé ;
- un terme déjà présent dans l'application (même type, même libellé sans tenir compte de la casse)
  est signalé à l'aperçu. Par défaut il est laissé tel quel ; en cochant « Remplacer leur
  définition par celle du paquet », sa définition, sa forme développée et ses images sont
  remplacées par celles du paquet, et il est rattaché au cours importé. Son libellé ne change pas.

### Définition riche

Une définition (ou la définition d'un acronyme) peut être un mini-cours : paragraphes, listes,
tableaux, blocs de code, citations, encadrés `[!retenir]`, `[!change]`, `[!attention]`, titres de
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
