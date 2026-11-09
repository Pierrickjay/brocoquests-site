# Fiches de révision (SEO)

Génère les pages `/orthographe/` du site à partir de la base BrocoPlumes.
Ce dossier commence par `_` : Jekyll l'ignore, il n'est donc pas publié.

## Utilisation

```bash
node _contenu/build.mjs
```

Aucune dépendance. Le script régénère `/orthographe/`, `sitemap.xml` et les liens « Fiches de révision gratuites » de l'accueil.

## Fichiers

| Fichier | Rôle |
|---|---|
| `data/essentiel.csv` | Export de la base (astuce, explication, exemples ❌/✅). Remplacer par un nouvel export puis relancer le script. |
| `categories.json` | Rubrique de chaque règle (par id du CSV). |
| `regles/<slug>.json` | Couche éditoriale. **Seules les règles qui ont ce fichier sont publiées.** |

## Ajouter une fiche

Créer `regles/<slug>.json` (copier `a-ou-a.json`). Champs :

- `id` (obligatoire) : id de la règle dans le CSV
- `h1`, `title` (≤ 60 car.), `description` (120 à 155 car.), `reponseCourte` (HTML, 2 ou 3 phrases) : obligatoires
- `complementRegle`, `sections` : contenu en plus de l'explication du CSV
- `pieges` : sinon, les exemples ❌/✅ du CSV
- `quiz` : `phrase` avec `___` à la place du trou, `options`, `reponse`, `explication`. Sinon, un quiz « quelle phrase est correcte ? » est construit à partir des exemples du CSV
- `faq`, `liees` (slugs des fiches à proposer ensuite ; celles qui n'existent pas encore sont ignorées)
- `slug` : par défaut, dérivé de l'item (`a / à` → `a-ou-a`)
- `accueil: true` : force la fiche dans les liens de la page d'accueil

Le suivi des téléchargements passe par `/app/?src=site&camp=regle-<slug>` (bouton) et `regle-<slug>-quiz` (fin du quiz).
