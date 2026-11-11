# Contrats partagés

## Contenu d'un cours

`course-content.example.json` est un cours d'exemple qui utilise tous les blocs, marques et attributs
produits par l'éditeur. Il est testé des deux côtés :

- le front vérifie que l'éditeur le relit et le réécrit à l'identique (`course-extensions.spec.ts`) ;
- l'API vérifie que sa liste blanche l'accepte (`validate-content.spec.ts`).

Ajouter un bloc à l'éditeur impose donc de l'ajouter ici, puis à la liste blanche de l'API.

## Paquet de cours

Un paquet de cours est une archive `.zip` qui contient :

- `cours.md` : le cours en Markdown, dont `cours.example.md` montre toutes les constructions acceptées ;
- `images/` : un fichier par figure (`fig-01.svg`, `fig-02.png`…), en SVG, PNG ou JPEG ;
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

Règles de `termes.json`, dont `termes.example.json` montre les trois formes d'entrée :

- une liste de 500 entrées au plus, chacune avec `type` (`definition` ou `acronyme`) et `libelle` ;
- `forme_developpee` est obligatoire pour un acronyme et interdite pour une définition ;
- `definition` est du Markdown, avec les mêmes constructions que `cours.md` sauf les images ;
  elle est obligatoire pour une définition, facultative pour un acronyme ;
- toute autre clé est refusée, ainsi que deux entrées de même type et de même libellé ;
- un terme déjà présent dans l'application (même type, même libellé sans tenir compte de la casse)
  est signalé à l'aperçu et laissé tel quel à l'import.

`termes.example.json` est lu par les tests de l'API (`parse-terms.spec.ts`,
`course-imports.e2e-spec.ts`).

`cours.example.md` est importé par les tests de l'API (`markdown-to-content.spec.ts`,
`course-imports.e2e-spec.ts`).
