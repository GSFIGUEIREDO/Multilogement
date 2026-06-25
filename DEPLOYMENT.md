# Déploiement en ligne

Cette version inclut un serveur Python, une base Supabase/Postgres en production, un fallback SQLite local et des sessions de connexion.

## Lancer localement

```powershell
$env:CLIMAPARC_HOST="127.0.0.1"
$env:CLIMAPARC_PORT="8000"
python server.py
```

Ouvrir ensuite:

```text
http://127.0.0.1:8000
```

## Supabase

Projet utilisé:

```text
Multilogement
ptuobxvzigxmcgqdhhnr
```

Tables créées:

- `climaparc_state`
- `climaparc_users`
- `climaparc_sessions`

## Variables de production Render

- `DATABASE_URL`: chaîne de connexion Postgres Supabase, avec mot de passe.
- `CLIMAPARC_HOST`: `0.0.0.0`.
- `PORT`: fourni automatiquement par Render.
- `CLIMAPARC_SESSION_TTL`: durée de session en secondes.
- `CLIMAPARC_DEBUG`: mettre une valeur seulement pour afficher les logs HTTP.

## Déployer sur un serveur

Le fichier `render.yaml` est prêt. Commande de démarrage:

```bash
python server.py
```

Sur Render, configurer:

- runtime Python 3.12, défini par `runtime.txt`
- variable `CLIMAPARC_HOST=0.0.0.0`
- variable `DATABASE_URL` depuis Supabase
- HTTPS activé sur le domaine public

## Important avant usage client réel

- Remplacer les mots de passe de démonstration.
- Activer les sauvegardes Supabase.
- Configurer un domaine HTTPS.
- Ajouter une rotation ou expiration plus stricte des sessions si nécessaire.
