# Semrank MCP

Connecte Claude à Semrank pour générer des briefs SEO, analyser la couverture sémantique de tes contenus et gérer tes briefs — directement dans la conversation.

## Installation

### 1. Récupère ta clé API

Connecte-toi sur [semrank.io](https://semrank.io) et récupère ta clé API dans les paramètres.

### 2. Ajoute à Claude Desktop

Ouvre les paramètres de Claude Desktop → **Developer > Edit Config**, et ajoute :

```json
{
  "mcpServers": {
    "semrank": {
      "command": "npx",
      "args": ["-y", "github:Nemzytch/semrank-mcp"],
      "env": {
        "SEMRANK_API_KEY": "ta_cle_api_ici"
      }
    }
  }
}
```

> **Tu as déjà le MCP Cuik ?** Pas de souci, ajoute simplement `"semrank"` à côté de `"cuik"` dans `mcpServers` :
>
> ```json
> {
>   "mcpServers": {
>     "cuik": {
>       "command": "npx",
>       "args": ["-y", "github:Nemzytch/cuik-mcp"],
>       "env": {
>         "CUIK_API_KEY": "sk_ta_cle_cuik"
>       }
>     },
>     "semrank": {
>       "command": "npx",
>       "args": ["-y", "github:Nemzytch/semrank-mcp"],
>       "env": {
>         "SEMRANK_API_KEY": "ta_cle_api_ici"
>       }
>     }
>   }
> }
> ```

Redémarre Claude Desktop pour charger le MCP.

### Ou : Ajoute à Claude Code (CLI)

```bash
claude mcp add semrank -- npx -y github:Nemzytch/semrank-mcp
```

Puis ajoute ta clé API dans ton environnement :

```bash
export SEMRANK_API_KEY="ta_cle_api_ici"
```

Redémarre Claude Code pour charger le MCP.

---

## Ce que tu peux faire

### Générer un brief SEO basique

Génère un brief complet pour n'importe quel mot-clé : mots-clés cibles, questions à traiter, structure de contenu, résultats SERP et analyse des concurrents.

> *"Génère un brief SEO pour le mot-clé 'consultant seo'"*
>
> *"Fais-moi un brief pour 'best running shoes' en anglais, marché US"*

---

### Générer un brief avancé

Brief plus poussé avec analyse IA approfondie, choix du type de page et du provider IA.

> *"Génère un brief avancé pour 'stratégie de contenu' en mode blog-post"*
>
> *"Brief avancé pour 'SaaS pricing page' en anglais, type landing-page"*

---

### Consulter et lister ses briefs

Retrouve tes briefs passés (basiques ou avancés), filtre par projet.

> *"Liste mes derniers briefs"*
>
> *"Montre-moi le brief avancé #42"*
>
> *"Quels briefs j'ai générés ce mois-ci ?"*

---

### Vérifier la couverture sémantique

Analyse un texte pour vérifier quels sujets SEO sont couverts (y compris via des synonymes).

> *"Vérifie si mon article couvre bien ces thèmes : [liste de topics]"*
>
> *"Analyse la couverture sémantique de ce texte par rapport au brief"*

---

### Vérifier ses crédits

> *"Combien de crédits il me reste ?"*

---

## Coûts en crédits

| Action | Crédits |
|--------|---------|
| Brief basique (nouveau) | 1 |
| Brief basique (en cache) | Gratuit |
| Brief avancé (nouveau) | 2 |
| Brief avancé (en cache) | Gratuit |
| Analyse de couverture | Gratuit |

---

## Variable d'environnement

| Variable | Requise | Description |
|----------|---------|-------------|
| `SEMRANK_API_KEY` | Oui | Ta clé API Semrank |
| `SEMRANK_API_URL` | Non | URL de l'API (défaut: `https://api-semrank.cuik.io`) |

---

## Licence

AGPL-3.0
