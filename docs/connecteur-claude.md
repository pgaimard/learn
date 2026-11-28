# Connecteur de Claude

Claude (Cowork, application de bureau, claude.ai) accède aux données de l'application par son
serveur MCP, à l'adresse `https://<nom-de-domaine>/api/mcp`. Le connecteur est appelé depuis le
cloud d'Anthropic : il ne fonctionne qu'avec l'application en production, pas avec `localhost`.

## Brancher Claude

1. Dans l'application : menu du compte → Administration → « Accès de l'IA ». Saisir le mot de
   passe et créer un jeton. Copier la valeur de l'en-tête affichée : elle ne le sera plus.
2. Dans Claude : Réglages → Connecteurs → ajouter un connecteur personnalisé.
   - Adresse : celle affichée dans l'écran Administration.
   - Authentification : « Aucune connexion » (le serveur utilise une clé, pas OAuth).
   - En-tête de requête : nom `x-api-key`, à choisir dans la liste, et valeur copiée à
     l'étape 1 (`learn_…`). Claude n'accepte que les noms de cette liste et réserve
     `Authorization` à OAuth.
3. Dans une conversation où le connecteur est activé, demander « liste mes UE ».

## Outils offerts

Les outils de lecture ne modifient rien. Les trois derniers écrivent : Claude demande une
confirmation avant de les appeler, et chaque écriture se défait par l'écran des versions du cours.

| Outil | Rôle |
|---|---|
| `list_ues` | Les UE, avec leur nombre de cours, de termes et de fichiers. |
| `list_courses` | Les cours d'une UE, dans leur ordre. |
| `get_course_outline` | Le plan d'un cours : révision, sections du cours, de la fiche et des exercices, clés des exercices. |
| `read_course_document` | Un document d'un cours en Markdown, en entier ou une section désignée par l'identifiant de son titre, avec ce qu'une réécriture perdrait. |
| `read_content_format` | La référence du format (`contracts/README.md`). |
| `list_terms` | Les termes d'une UE, filtrables par cours et par type. |
| `read_term` | Un terme aux clés de `termes.json`, et sa définition en Markdown. |
| `list_tools` | Les outils, avec les UE où ils servent. |
| `read_tool` | Un outil aux clés de `commandes.json`, la liste de ses commandes et sa fiche en Markdown. |
| `read_commands` | Toutes les commandes d'un outil, aux clés de `commandes.json`. |
| `search` | La recherche de l'interface : cours, définitions, acronymes, fichiers, outils, commandes. |
| `replace_section` | Remplace une section d'un document par du Markdown, sans toucher au reste. |
| `insert_section` | Insère une section après une autre, ou à la fin du document. |
| `delete_section` | Supprime une section et ses sous-sections. |
| `create_course` | Crée un cours dans une UE, à la suite des autres, avec son texte en Markdown. |
| `set_course_document` | Pose en entier la fiche ou les exercices d'un cours : les crée, ou les remplace. |
| `add_exercises` | Ajoute des QCM ou des exercices à la fin des exercices d'un cours, créés s'il n'en a pas. |
| `set_exercise_solution` | Remplace le corrigé d'un exercice désigné par sa clé, sans toucher à son énoncé. |

Une écriture est refusée si le cours a changé depuis la révision lue, s'il est ouvert dans
l'éditeur, ou si elle ferait perdre des réponses déjà enregistrées (exercice renommé ou retiré,
QCM déplacé). Avant chaque écriture, l'état du cours est gardé : il se retrouve sous « Avant une
modification par l'IA » dans les versions du cours.

Un cours créé par l'IA n'a pas d'état d'avant : il n'a pas d'instantané, et se supprime dans
l'application. Le texte d'un cours existant ne se pose pas en entier : il se modifie section par
section. L'IA ne peut supprimer ni cours, ni UE, ni fichier.

## Révoquer l'accès

Écran Administration → « Révoquer l'accès » : le jeton cesse aussitôt de fonctionner. Créer un
nouveau jeton révoque aussi le précédent ; il faut alors mettre à jour l'en-tête du connecteur.

## À savoir

- Le jeton est conservé par Anthropic dans la configuration du connecteur. Toute conversation
  où le connecteur est activé peut appeler les outils.
- Le jeton ne donne accès qu'au serveur MCP : ni au reste de l'API, ni au compte, ni à l'export.
- L'écran Administration affiche la date de dernière utilisation du jeton.

## Essayer en local

Avec l'API lancée sur le poste, un client MCP local (Claude Code, par exemple) joint
`http://localhost:3000/api/mcp` avec le même en-tête.
