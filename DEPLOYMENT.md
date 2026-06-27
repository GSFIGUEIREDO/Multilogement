# DÃ©ploiement en ligne

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

Projet utilisÃ©:

```text
Multilogement
ptuobxvzigxmcgqdhhnr
```

Tables crÃ©Ã©es:

- `climaparc_state`
- `climaparc_users`
- `climaparc_sessions`

## Variables de production Render

- `DATABASE_URL`: chaÃ®ne de connexion Postgres Supabase, avec mot de passe. Ne pas utiliser l'URL API `https://...supabase.co`.
- `CLIMAPARC_HOST`: `0.0.0.0`.
- `PORT`: fourni automatiquement par Render.
- `CLIMAPARC_SESSION_TTL`: durÃ©e de session en secondes.
- `CLIMAPARC_DEBUG`: mettre une valeur seulement pour afficher les logs HTTP.

## Recuperation de mot de passe par email

Le bouton `Mot de passe oublie` envoie un vrai email seulement si un serveur SMTP est configure dans Render.

Variables a ajouter dans Render:

- `APP_BASE_URL`: `https://multilogement.onrender.com`
- `SMTP_HOST`: serveur SMTP, par exemple `smtp.gmail.com`, `smtp.sendgrid.net` ou celui de votre fournisseur email
- `SMTP_PORT`: generalement `587`
- `SMTP_USER`: utilisateur SMTP
- `SMTP_PASSWORD`: mot de passe SMTP ou cle API
- `SMTP_FROM`: adresse expediteur, par exemple `no-reply@votredomaine.com`

Sans ces variables, la demande est enregistree mais aucun email ne peut etre envoye.

## DÃ©ployer sur un serveur

Le fichier `render.yaml` est prÃªt. Commande de dÃ©marrage:

```bash
python server.py
```

Sur Render, configurer:

- runtime Python 3.12, dÃ©fini par `runtime.txt`
- variable `CLIMAPARC_HOST=0.0.0.0`
- variable `DATABASE_URL` depuis Supabase
- HTTPS activÃ© sur le domaine public

## Important avant usage client rÃ©el

- Remplacer les mots de passe de dÃ©monstration.
- Activer les sauvegardes Supabase.
- Configurer un domaine HTTPS.
- Ajouter une rotation ou expiration plus stricte des sessions si nÃ©cessaire.

## Format correct de `DATABASE_URL`

Utiliser une URL Postgres:

```text
postgresql://postgres:[MOT_DE_PASSE]@db.ptuobxvzigxmcgqdhhnr.supabase.co:5432/postgres
```

Ne pas utiliser:

```text
https://ptuobxvzigxmcgqdhhnr.supabase.co
```

Cette derniÃ¨re est l'URL API Supabase, pas la connexion Postgres.
