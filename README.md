# ClimaParc / Multilogement

Application de gestion HVAC pour immeubles multilogements:

- lieux et appartements;
- équipements et historique;
- demandes des clients;
- bons de travail et interventions terrain;
- formulaires configurables avec branchement;
- rappels, recommandations, documents et rapports;
- profils administrateur, équipe interne, technicien et client.

## Démarrage local

Installer les dépendances:

```powershell
pip install -r requirements.txt
```

Démarrer l'application principale FastAPI:

```powershell
$env:CLIMAPARC_SERVER_MODE="fastapi"
python start.py
```

L'application est disponible sur `http://127.0.0.1:8000`.

Le mode par défaut est déjà `fastapi`; définir la variable explicitement est
utile pour rendre l'environnement local lisible.

## Serveur de production

La production Render doit utiliser:

```text
Start Command: python start.py
CLIMAPARC_SERVER_MODE: fastapi
Health Check Path: /api/health
```

`python server.py` n'est pas le serveur de production. Il reste disponible
uniquement à travers `CLIMAPARC_SERVER_MODE=legacy` comme retour temporaire.

Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour la configuration complète.

## Architecture

Le serveur actif est FastAPI (`src/climaparc/main.py`). Les domaines backend
sont organisés en:

- `domain`: règles, politiques et interfaces;
- `application/use_cases`: une action par use case;
- `infrastructure`: repositories et adaptateurs;
- `presentation`: routers FastAPI et injection de dépendances.

Le frontend charge des vues par domaine dans `frontend/views/`; `app.js`
conserve le shell, la navigation et la coordination de l'état UI.

Tous les domaines applicatifs sont migrés vers les use cases. La persistance
reste toutefois en transition: plusieurs repositories utilisent encore
`climaparc_state` et les colonnes `payload` comme couche de compatibilité.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour le statut précis par domaine.

## Base de données et fichiers

- Production: Supabase/Postgres via `DATABASE_URL`.
- Développement: SQLite via `CLIMAPARC_DB`.
- Fichiers de production: bucket privé Supabase Storage.
- Fallback fichiers local: `local_uploads/`, développement seulement.

Les mots de passe, tokens, clés de service et contenus base64 ne doivent jamais
être exposés dans le frontend ou dans les réponses publiques.

## Tests

Les smoke tests couvrent les routers FastAPI, l'isolation multi-client,
l'authentification, les domaines métier et le chargement des modules frontend.

```powershell
python tests/auth_fastapi_smoke.py
python tests/security_smoke.py
node tests/frontend_modules_smoke.js
```
