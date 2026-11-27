## 1. QCM

> [!qcm] Autour des processus
>
> 1. Un processus est :
>    - [x] la dynamique de l'exécution d'un programme
>    - [ ] un programme exécutable
>    - [ ] un logiciel
>
>    Un programme n'est que du code rangé sur disque ; le **processus** est ce programme en
>    cours d'exécution, avec son état.
>
> 2. Une ressource critique :
>    - [ ] est une ressource qui peut être partagée entre plusieurs processus
>    - [x] est une ressource qui ne peut pas être partagée entre plusieurs processus
>    - [x] est une ressource accédée en exclusion mutuelle
>
>    Les deux dernières formulations disent la même chose : un seul processus à la fois.

## 2. Exercices

Les énoncés sont ceux du support d'origine, repris tels quels.

> [!exercice] Exercice 1 : ordonnancement
>
> On considère trois processus, soumis dans l'ordre P1, P2, P3.
>
> | Processus | Temps d'exécution |
> |-----------|-------------------|
> | P1        | 3                 |
> | P2        | 2                 |
> | P3        | 1                 |
>
> **Question 1.** Dessinez l'ordonnancement FIFO.
>
> **Question 2.** Donnez le temps de réponse moyen.
>
> > [!corrige]
> > **La méthode.** Dresser la file des processus prêts, puis dessiner le diagramme de Gantt.
> >
> > | Processus | 0   | 1   | 2   | 3   | 4   | 5   |
> > |-----------|-----|-----|-----|-----|-----|-----|
> > | P1        | [x] | [x] | [x] | [ ] | [ ] | [ ] |
> > | P2        | [ ] | [ ] | [ ] | [x] | [x] | [ ] |
> > | P3        | [ ] | [ ] | [ ] | [ ] | [ ] | [x] |
> >
> > Temps de réponse : 3, 5 et 6, soit une moyenne de **4,67**.
