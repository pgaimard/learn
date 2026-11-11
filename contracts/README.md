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
- des titres de niveau 2 à 4 (`##` à `####`) ; le niveau 1 est réservé au titre du chapitre ;
- un encadré est une citation dont la première ligne est `[!retenir]`, `[!change]` ou `[!attention]` ;
- une image est seule dans son paragraphe : `![texte alternatif](images/fig-01.svg "Légende")` ;
- le HTML n'est pas interprété : il reste du texte.

`cours.example.md` est importé par les tests de l'API (`markdown-to-content.spec.ts`,
`course-imports.e2e-spec.ts`).
