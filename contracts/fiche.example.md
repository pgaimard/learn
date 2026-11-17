## L'essentiel

Un **processus** est un programme en cours d'exécution. Il passe par trois états.

![Schéma des trois états d'un processus](images/fiche-01.svg "Les trois états")

| État | Le processus… |
|------|---------------|
| Prêt | attend le processeur |
| Élu | s'exécute |
| Bloqué | attend un événement |

> [!retenir]
> Un processus bloqué ne consomme pas de temps processeur.

## À savoir refaire

1. Créer un processus avec `fork()`.
2. Distinguer le père du fils par la valeur renvoyée.

```c
pid_t pid = fork();
```

> [!attention]
> Ne pas confondre programme et processus.
