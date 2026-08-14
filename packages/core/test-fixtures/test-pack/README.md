# Pack de test

Deux lignées fictives, utilisées par la suite de tests. Il n'existe que pour que le moteur
soit testable **sans dépendre du pack réel** — ni de son téléchargement, ni de sa licence.

Les créatures sont inventées : aucune ressemblance avec une œuvre existante, et aucun
sprite n'accompagne ce manifeste. Les chemins `sprite` pointent vers des fichiers qui
n'existent pas, ce qui est volontaire — les tests valident la structure, pas les images.

Voir l'invariant I9 dans [../../ROADMAP.md](../../ROADMAP.md) : aucun identifiant de
créature n'est écrit en dur dans le code, tout passe par un manifeste.
