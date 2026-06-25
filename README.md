# ClimaParc - Gestion HVAC

Application web locale en français pour gérer un parc HVAC multi-immeubles.

## Ouvrir en mode local

Ouvrez `index.html` dans un navigateur.

## Ouvrir en mode en ligne

Lancez le serveur:

```powershell
python server.py
```

Puis ouvrez `http://127.0.0.1:8000`.

En mode en ligne de production, les données sont conservées dans Supabase/Postgres. Sans `DATABASE_URL`, le serveur utilise `climaparc.sqlite3` comme fallback local.

## Comptes de démonstration

- Administrateur: `admin@climaparc.ca` / `admin123`
- Équipe interne: `operation@climaparc.ca` / `interne123`
- Technicien: `tech@climaparc.ca` / `tech123`
- Client: `client@gestionazur.ca` / `client123`

## Fonctions incluses

- Inventaire des équipements par client, immeuble et appartement
- Création des lieux par nom de bâtiment et adresse
- Contacts par lieu: ressource sur place, facturation, email, téléphone et notes
- Appartements affichés à l'intérieur de chaque lieu
- Historique des interventions par équipement
- Portail client avec accès limité aux immeubles du client
- Création et modification des équipements, appels de service, bons de travail et utilisateurs
- Types d'appels de service configurables
- Types de checklists / interventions configurables
- Export de rapports CSV
- Contrôle modifiable des rôles, droits et accès

En ouvrant seulement `index.html`, les données restent dans le stockage local du navigateur. En passant par `server.py` avec `DATABASE_URL`, elles sont centralisées dans Supabase.
