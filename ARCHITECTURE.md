# Architecture ClimaParc

## Vue d'ensemble

ClimaParc utilise:

- FastAPI comme serveur HTTP principal;
- une architecture par domaines;
- des use cases injectés par `Depends`;
- des repositories derrière des interfaces de domaine;
- Supabase/Postgres en production et SQLite en développement;
- Supabase Storage privé pour les fichiers.

Flux actif:

```text
Frontend -> Router FastAPI -> Use Case -> Repository -> Postgres/Storage
```

Point de démarrage:

```text
python start.py
CLIMAPARC_SERVER_MODE=fastapi
```

Le mode `legacy` est un fallback temporaire, pas l'architecture active.

## Structure

```text
start.py                       Sélection FastAPI/legacy
server.py                      Fallback HTTP historique

src/climaparc/
  main.py                      Application FastAPI principale
  auth/
  users/
  places/
  equipment/
  tickets/
  work_orders/
  interventions/
  documents/
  recommendations/
  reminders/
  settings/
  reports/
  state/
  web/

backend/
  database.py                  Connexion et primitives SQL
  schema.py                    Initialisation du schéma
  sync_services.py            Synchronisation relationnelle
  security.py                 Isolation client et permissions
  repositories.py             Repositories de compatibilité state/payload
  state_compatibility.py       Merge du state historique
  legacy_*.py                 Fallback `CLIMAPARC_SERVER_MODE=legacy`
  services.py                  Adaptateurs de compatibilité vers les use cases
  auth_services.py             Adaptateurs Auth du fallback legacy

frontend/
  api.js
  storage.js
  views/
    dashboard.js
    reports.js
    documents.js
    recommendations.js
    places.js
    users.js
    equipment.js
    tickets.js
    work-orders.js
    settings.js
    interventions.js
    form-builder.js
```

Chaque domaine backend suit la structure:

```text
domain/            Interfaces et politiques
application/       Commandes et use cases
infrastructure/    Repositories concrets
presentation/      Router FastAPI, Depends et dispatch
```

## Statut par domaine

`Migré` signifie que les règles et endpoints passent par des use cases. Cela
ne signifie pas encore que le domaine est indépendant de `climaparc_state`.

| Domaine | Use cases | Router FastAPI | Persistance actuelle |
|---|---:|---:|---|
| Auth/session/reset | Oui | Oui | tables auth/session + state filtré |
| Utilisateurs | Oui | Oui | table auth + `climaparc_state` |
| Lieux/appartements | Oui | Oui | lecture state hydraté + écritures tables lieux/appartements |
| Équipements | Oui | Oui | lecture state hydraté + écritures table équipement/payload |
| Demandes clients | Oui | Oui | lecture state hydraté + écritures table ticket/payload |
| Bons de travail | Oui | Oui | state + table BT/payload |
| Interventions | Oui | Oui | state + table intervention/payload |
| Documents | Oui | Oui | state/metadata + Supabase Storage |
| Recommandations | Oui | Oui | intervention payload + state |
| Rappels | Oui | Oui | lecture state hydraté + écritures table rappel/payload |
| Paramètres/formulaires | Oui | Oui | lecture state hydraté + écritures relationnelles/payload |
| Rapports | Oui | Oui | lecture du state hydraté |
| State compatibility | Oui | Oui | `climaparc_state` |
| Web/statique/health | N/A | Oui | fichiers locaux + health DB |

Tous les domaines applicatifs prévus ont donc été migrés vers l'architecture
use case. Il n'existe plus de liste de « prochains domaines à migrer ».

## Dépendances legacy restantes

### `climaparc_state`

La majorité des `*StateRepository` utilise encore `LegacyStateRepository`.
Les use cases chargent un état hydraté, appliquent les règles de scope,
écrivent la collection concernée et retournent un state filtré.

Exceptions déjà consolidées:

- `settings` lit encore un état hydraté pour composer la réponse frontend, mais
  ses sauvegardes et suppressions écrivent uniquement dans les tables
  relationnelles/payload et ne réécrivent plus `climaparc_state`.
- `reminders` / `Rappels` conserve la lecture de contexte via l'état hydraté,
  mais ses créations, mises à jour, lots et suppressions écrivent uniquement
  dans `climaparc_reminders`.
- `equipment` / `Équipements` conserve la lecture de contexte via l'état
  hydraté, mais ses créations et mises à jour écrivent uniquement dans
  `climaparc_equipment` et synchronisent les pièces jointes normalisées.
- `places` / `Lieux et appartements` conserve la lecture de contexte via
  l'état hydraté, mais ses créations et mises à jour écrivent uniquement dans
  `climaparc_buildings`, `climaparc_apartments` et `climaparc_building_contacts`.
- `tickets` / `Demandes clients` conserve la lecture de contexte via l'état
  hydraté, mais ses créations et mises à jour écrivent uniquement dans
  `climaparc_tickets`.

Domaines encore dépendants du state central:

- Auth pour composer la session publique;
- utilisateurs;
- lieux et appartements pour la lecture de contexte seulement;
- équipements pour la lecture de contexte seulement;
- demandes clients pour la lecture de contexte seulement;
- bons de travail;
- interventions;
- documents et recommandations;
- rappels pour la lecture de contexte seulement;
- paramètres/formulaires pour la lecture de contexte seulement;
- rapports.

La migration applicative est terminée, mais la migration de persistance ne
l'est donc pas. La cible est que chaque repository lise et écrive directement
ses tables normalisées, sans reconstruire l'application à partir d'un document
JSON global.

### Colonnes `payload`

Les tables relationnelles conservent des colonnes `payload` pour le dual-write
et l'hydratation compatibles. Les tables enfants normalisées existent déjà,
notamment pour:

- contacts des lieux;
- techniciens des BT;
- options des champs de données;
- questions, options et branchements des formulaires;
- permissions des rôles;
- réponses et valeurs multiples d'intervention;
- pièces jointes;
- messages de recommandations.

Les nouveaux rapports, filtres et intégrations doivent privilégier les colonnes
et tables normalisées. Le retrait des `payload` viendra après migration complète
des repositories.

### Services legacy

- `backend/services.py`: adaptateurs fins vers les use cases, conservés pour
  compatibilité et tests; ils ne portent plus les règles métier principales.
- `backend/auth_services.py`: adaptateurs Auth utilisés par le serveur fallback
  et certains tests.
- `backend/legacy_*`: contrôleurs du mode `legacy` seulement.

Le serveur FastAPI actif appelle directement les use cases via les dépendances
de `src/climaparc/*/presentation`.

## Endpoints

### Endpoints FastAPI actifs

Le frontend utilise les routes suivantes, toutes desservies par FastAPI:

- `GET /api/health`
- `GET /api/session`
- `POST /api/login`
- `POST /api/signup`
- `POST /api/logout`
- `POST /api/password-reset-request`
- `POST /api/password-reset-confirm`
- `POST /api/user`
- `POST /api/user-delete`
- `POST /api/building`
- `POST /api/apartment`
- `POST /api/equipment`
- `POST /api/ticket`
- `POST /api/work-order`
- `POST /api/intervention`
- `POST /api/reminder`
- `POST /api/reminder-delete`
- `POST /api/setting-item`
- `POST /api/setting-item-delete`
- `POST /api/report-context`
- `POST /api/recommendation/client-response`
- `POST /api/recommendation/review`
- `POST /api/file-upload`
- `POST /api/file-url`
- `POST /api/file-delete`

Ces URLs sont conservées pour compatibilité frontend, mais leurs implémentations
actives ne sont pas des handlers legacy.

### Endpoints de compatibilité

- `POST /api/state`: compatibilité temporaire pour les modifications globales;
  limité aux profils `administrateur` et `equipe_interne`.
- `GET /api/local-file`: fallback de fichiers en développement local.
- Les routes définies dans `backend/legacy_routes.py` existent uniquement
  lorsque `CLIMAPARC_SERVER_MODE=legacy`.

Les nouvelles fonctionnalités persistantes ne doivent pas utiliser
`/api/state`; elles doivent avoir un endpoint, un use case et un repository de
domaine.

## Sécurité

- Le backend filtre les réponses par profil, client, lieux autorisés et droits.
- Les use cases reçoivent l'utilisateur courant et appliquent l'autorisation.
- `/api/state` n'est pas accessible aux clients ou techniciens.
- Les mots de passe et tokens restent hors du state public.
- La clé Supabase Service Role reste uniquement côté serveur.
- Les documents sont autorisés avant génération d'une URL signée.

## Travail technique restant

Il ne reste pas de domaine à migrer vers les use cases. Les travaux suivants
sont une consolidation de persistance:

1. remplacer progressivement chaque `*StateRepository` par des lectures
   relationnelles directes;
2. étendre à tous les domaines le modèle déjà appliqué à `settings`: écrire
   uniquement dans les tables de domaine, puis reconstruire la réponse depuis
   ces tables;
3. supprimer le dual-write `climaparc_state`/payload après comparaison;
4. retirer `/api/state` du frontend;
5. supprimer `server.py`, `backend/legacy_*` et les adaptateurs après la période
   de stabilité FastAPI;
6. ajouter des migrations SQL versionnées et des tests d'intégration Postgres.
