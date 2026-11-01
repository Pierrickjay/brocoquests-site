# Générateur de QR codes

Génère un QR code (SVG + PNG 2048 px, correction d'erreur niveau H) à partir d'une URL, avec le logo BrocoQuests au centre en option.

Ce dossier commence par `_` : Jekyll l'ignore, il n'est donc pas publié sur brocoquests.fr.

## Installation

```bash
cd _qr-codes
npm install
```

## Utilisation

```bash
node generate.mjs <url> [--logo] [--name <nom>]
```

| Option | Effet |
|---|---|
| `--logo` | Ajoute le logo (`../icon.png`) au centre, sur un fond blanc arrondi (environ 15 % de la surface) |
| `--name <nom>` | Nom des fichiers générés. Par défaut : la valeur du paramètre `src` de l'URL, sinon `qr` |

Les fichiers sont écrits dans `output/` : `<nom>.svg` et `<nom>.png`, ou `<nom>-logo.svg` et `<nom>-logo.png` avec `--logo`.

### Exemples

```bash
node generate.mjs "https://brocoquests.fr/app/?src=flyer" --logo
# → output/flyer-logo.svg, output/flyer-logo.png

node generate.mjs "https://brocoquests.fr/app/?src=salon-paris&camp=printemps" --name salon-paris
# → output/salon-paris.svg, output/salon-paris.png
```

Mets toujours l'URL entre guillemets, sinon le shell interprète le `&`.

## Quelles URLs utiliser

Les QR codes doivent pointer vers `https://brocoquests.fr/app/` (avec le `/` final, ce qui évite une redirection). La page redirige ensuite vers le bon store et enregistre la visite dans PostHog.

| Paramètre | Rôle | Remonte dans |
|---|---|---|
| `src` | Source : `flyer`, `instagram`, `salon-paris`… (40 caractères max) | PostHog, App Store Connect (`ct`), Play Console (`utm_source`) |
| `camp` | Campagne, facultatif | PostHog, Play Console (`utm_campaign`) |

Pour distinguer deux supports côté App Store, il faut une valeur de `src` différente pour chacun : `camp` n'y remonte pas.

## Conseils d'impression

- **Le PNG** sert pour les réseaux sociaux et les documents numériques. **Le SVG** est vectoriel : c'est lui qu'on envoie à l'imprimeur.
- Taille minimale imprimée : environ 2 × 2 cm, plus si le QR code doit être scanné de loin.
- Teste chaque QR code avec un téléphone iOS et un téléphone Android avant d'imprimer.
