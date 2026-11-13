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

Règles de `termes.json`, dont `termes.example.json` montre les quatre formes d'entrée
(définition, acronyme défini, acronyme seul, définition riche) :

- une liste de 500 entrées au plus, chacune avec `type` (`definition` ou `acronyme`) et `libelle` ;
- `forme_developpee` est obligatoire pour un acronyme et interdite pour une définition ;
- `definition` est du Markdown de 10 000 caractères au plus, avec les mêmes constructions que
  `cours.md`, images comprises ; elle est obligatoire pour une définition, facultative pour un
  acronyme ;
- toute autre clé est refusée, ainsi que deux entrées de même type et de même libellé ;
- un terme déjà présent dans l'application (même type, même libellé sans tenir compte de la casse)
  est signalé à l'aperçu et laissé tel quel à l'import.

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
- les images d'un terme déjà présent dans l'application ne sont pas importées, puisque ce terme
  est laissé tel quel.

Un paquet sans image de définition reste valide : rien n'est à changer dans les paquets existants.
Le Markdown collé, sans paquet, ne transporte toujours ni image ni terme.

`termes.example.json` est lu par les tests de l'API (`parse-terms.spec.ts`,
`course-imports.e2e-spec.ts`).

`cours.example.md` est importé par les tests de l'API (`markdown-to-content.spec.ts`,
`course-imports.e2e-spec.ts`).
