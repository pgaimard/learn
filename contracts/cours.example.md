---
ue: UTC502
titre: Les processus : notions de base
ordre: 3
---

## 1. Notion de processus

Un **processus** est un *programme en cours d'exécution*. Il est créé par l'appel
`fork()`, décrit dans la [documentation du CNAM](https://www.cnam.fr).

### 1.1 États d'un processus

- Prêt
- Élu
- Bloqué

![Schéma des trois états d'un processus](images/fig-01.svg "Figure 1 : états d'un processus")

> [!retenir]
> Un processus bloqué ne consomme pas de temps processeur.

> [!change]
> Les systèmes récents ordonnancent des fils d'exécution plutôt que des processus.

> [!attention]
> Ne pas confondre programme et processus.

#### 1.1.1 Exemple

```c
pid_t pid = fork();
```

##### Valeur de retour

`fork()` renvoie 0 dans le processus créé.

## 2. Ordonnancement

| Algorithme | Préemptif |
|------------|-----------|
| FIFO       | Non       |
| Tourniquet | Oui       |

1. Trop court : trop de commutations.
2. Trop long : mauvaise réactivité.

> Une citation ordinaire reste une citation.
