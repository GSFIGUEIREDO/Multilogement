# Architecture ClimaParc

## Pattern choisi

Le projet applique progressivement une combinaison de:

- **MVC / Controller fin**: `server.py` reçoit les requêtes HTTP et sert l'interface.
- **Service Layer**: `backend/services.py` contient les règles métier.
- **Repository Pattern**: `backend/repositories.py` isole les opérations de persistance.
- **Database Gateway**: `backend/database.py` centralise connexion, SQL compatible SQLite/Postgres et helpers de sécurité.

Ce choix garde le déploiement actuel simple tout en séparant les responsabilités pour audit et évolution.

## Organisation

```text
index.html          Interface livrée au navigateur
app.js              UI / logique d'écran côté navigateur
styles.css          Styles de l'interface
server.py           Controller HTTP, sessions, routes legacy
backend/
  database.py       Connexion DB, helpers SQL/JSON/password
  repositories.py   Lecture/écriture état, utilisateurs, équipements
  services.py       Règles métier utilisateurs et équipements
```

## Règle de dépendance

```text
UI -> HTTP Controller -> Services -> Repositories -> Database
```

La couche UI ne doit pas écrire directement dans la base. Le controller ne doit pas contenir de règles métier complexes. Toute nouvelle fonctionnalité devrait d'abord créer un service, puis un repository si elle doit persister des données.

## Migration progressive

Le projet conserve encore un état JSON central (`climaparc_state`) pour compatibilité. Les nouvelles routes critiques (`/api/equipment`, `/api/user`) passent déjà par la nouvelle architecture. Les prochaines migrations recommandées sont:

1. `Demandes des clients`
2. `Bons de travail`
3. `Lieux / Appartements`
4. `Rappels`
5. `Documents`

Chaque migration doit suivre le même modèle: service métier, repository dédié, puis controller fin.
