# Architecture ClimaParc

## Pattern choisi

Le projet applique progressivement une combinaison de:

- **MVC / Controller fin**: `server.py` recoit les requetes HTTP et sert l'interface.
- **Service Layer**: `backend/services.py` contient les regles metier.
- **Repository Pattern**: `backend/repositories.py` isole les operations de persistence.
- **Database Gateway**: `backend/database.py` centralise connexion, SQL compatible SQLite/Postgres et helpers de securite.
- **Frontend Service Layer**: `frontend/api.js` isole les appels HTTP; `frontend/storage.js` isole le stockage local.

Ce choix garde le deploiement actuel simple tout en separant les responsabilites pour audit et evolution.

## Organisation

```text
index.html             Charge l'interface et les couches frontend
app.js                 UI et orchestration d'ecran cote navigateur
styles.css             Styles de l'interface

frontend/
  api.js               Service API cote navigateur
  storage.js           Persistence locale cote navigateur

server.py              Controller HTTP, sessions, routes legacy

backend/
  database.py          Connexion DB, helpers SQL/JSON/password
  repositories.py      Lecture/ecriture etat, utilisateurs, equipements
  services.py          Regles metier utilisateurs et equipements
```

## Regle de dependance

```text
UI -> Frontend Services -> HTTP Controller -> Backend Services -> Repositories -> Database
```

La couche UI ne doit pas appeler `fetch` directement ni manipuler `localStorage` directement.
Le controller ne doit pas contenir de regles metier complexes.
Toute nouvelle fonctionnalite persistante devrait suivre ce modele:

```text
app.js -> frontend/api.js -> server.py -> backend/services.py -> backend/repositories.py -> backend/database.py
```

## Etat actuel

Routes deja migrees vers la nouvelle architecture:

- `/api/equipment`
- `/api/user`

Frontend deja separe:

- appels serveur dans `frontend/api.js`
- stockage local dans `frontend/storage.js`

Le projet conserve encore un etat JSON central (`climaparc_state`) pour compatibilite. Les prochaines migrations recommandees sont:

1. `Demandes des clients`
2. `Bons de travail`
3. `Lieux / Appartements`
4. `Rappels`
5. `Documents`
6. Decoupage progressif de `app.js` en modules de vues par domaine

Chaque migration doit suivre le meme modele: service metier, repository dedie, puis controller fin.
