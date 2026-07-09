# Déploiement ClimaParc

## Configuration Render actuelle

ClimaParc utilise un seul Web Service Render et Supabase/Postgres.

Configuration de production obligatoire:

```text
Build Command: pip install -r requirements.txt
Start Command: python start.py
Health Check Path: /api/health
CLIMAPARC_SERVER_MODE: fastapi
```

Le mode `fastapi` est aussi la valeur par défaut de `start.py`.

Ne pas configurer `python server.py` comme commande de production. Le serveur
historique reste uniquement un fallback temporaire, activé avec:

```text
Start Command: python start.py
CLIMAPARC_SERVER_MODE: legacy
```

## Variables Render

### Application et base de données

- `CLIMAPARC_SERVER_MODE`: `fastapi`.
- `CLIMAPARC_HOST`: `0.0.0.0`.
- `PORT`: fourni automatiquement par Render.
- `DATABASE_URL`: connexion Postgres Supabase.
- `APP_BASE_URL`: `https://multilogement.onrender.com`.
- `CLIMAPARC_SESSION_TTL`: durée de session en secondes, par exemple `28800`.

`DATABASE_URL` doit être une URL Postgres, jamais l'URL API Supabase:

```text
postgresql://postgres:[MOT_DE_PASSE]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### Supabase Storage

- `SUPABASE_URL`: URL API du projet.
- `SUPABASE_SERVICE_ROLE_KEY`: clé serveur, jamais exposée au frontend.
- `CLIMAPARC_STORAGE_BUCKET`: `climaparc-documents` par défaut.

Le bucket doit être privé. Le backend génère des URLs signées temporaires pour
la visualisation et le téléchargement.

Limites actuelles:

- documents client: 10 MB;
- pièces jointes d'intervention ou d'équipement: 15 MB;
- formats: PDF, images, Word, Excel et PowerPoint.

Sans configuration Storage en développement local, les fichiers sont placés
dans `local_uploads/`. Ce fallback ne doit pas être utilisé en production.

### SMTP

- `SMTP_HOST`
- `SMTP_PORT`, généralement `587`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Sans SMTP, la demande de réinitialisation peut être enregistrée mais aucun
email ne sera envoyé.

## Démarrage local

FastAPI:

```powershell
$env:CLIMAPARC_HOST="127.0.0.1"
$env:CLIMAPARC_PORT="8000"
$env:CLIMAPARC_SERVER_MODE="fastapi"
python start.py
```

SQLite local optionnel:

```powershell
$env:CLIMAPARC_DB="climaparc.sqlite3"
```

## Vérification après déploiement

1. Confirmer que le déploiement Render est `Live`.
2. Ouvrir `/api/health`.
3. Vérifier une réponse avec `ok: true` et `database: postgres`.
4. Tester connexion, session et déconnexion.
5. Tester la création/modification d'un utilisateur.
6. Tester lieu, équipement, demande client, BT et intervention.
7. Tester upload, visualisation et téléchargement d'un document.
8. Vérifier les logs Render pour les erreurs HTTP 500/502/503.

## Retour temporaire

En cas de régression FastAPI:

1. ouvrir `Environment` dans le même service Render;
2. passer `CLIMAPARC_SERVER_MODE` de `fastapi` à `legacy`;
3. enregistrer et redémarrer le service;
4. remettre `fastapi` après correction.

Il n'est pas nécessaire de changer de serveur, d'URL ou de base de données.
Voir [FASTAPI_ROLLOUT.md](FASTAPI_ROLLOUT.md) pour la procédure détaillée.
