# Connecteur de Claude

Claude (Cowork, application de bureau, claude.ai) accède aux données de l'application par son
serveur MCP, à l'adresse `https://<nom-de-domaine>/api/mcp`. Le connecteur est appelé depuis le
cloud d'Anthropic : il ne fonctionne qu'avec l'application en production, pas avec `localhost`.

## Brancher Claude

1. Dans l'application : menu du compte → Administration → « Accès de l'IA ». Saisir le mot de
   passe et créer un jeton. Copier la valeur de l'en-tête affichée : elle ne le sera plus.
2. Dans Claude : Réglages → Connecteurs → ajouter un connecteur personnalisé.
   - Adresse : celle affichée dans l'écran Administration.
   - En-tête de requête : nom `Authorization`, valeur copiée à l'étape 1 (`Bearer learn_…`).
3. Dans une conversation où le connecteur est activé, demander « liste mes UE ».

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
