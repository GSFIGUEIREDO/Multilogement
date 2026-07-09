# Transition FastAPI sur Render

Le service Render, l'URL publique et la base Supabase restent les memes. Seul
le processus Python qui sert l'application change.

## Configuration normale

Le depot utilise maintenant:

```text
Start Command: python start.py
CLIMAPARC_SERVER_MODE: fastapi
Health Check Path: /api/health
```

`start.py` lit le port fourni par Render et lance Uvicorn avec
`src.climaparc.main:app`.

## Verification apres deploiement

1. Confirmer que le deploiement Render est `Live`.
2. Ouvrir `/api/health` et verifier que `ok` vaut `true`.
3. Tester la connexion, la creation d'un utilisateur et la modification d'un
   equipement.
4. Tester un document et une action avec un profil client.
5. Examiner les logs Render pour confirmer l'absence d'erreurs 500.

## Retour temporaire au serveur historique

Il n'est pas necessaire de modifier le code ni de changer de service Render:

1. Ouvrir `Environment` dans le service Render.
2. Modifier `CLIMAPARC_SERVER_MODE` de `fastapi` vers `legacy`.
3. Enregistrer et relancer le service.

Pour revenir a FastAPI, remettre la valeur `fastapi`.

Le fichier `server.py` reste disponible pendant la periode de transition.
