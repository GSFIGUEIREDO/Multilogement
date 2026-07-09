# Architecture ClimaParc

## Pattern choisi

Le projet applique progressivement une combinaison de:

- **MVC / Controller fin**: `server.py` recoit les requetes HTTP et sert l'interface.
- **Service Layer**: `backend/services.py` contient les regles metier.
- **Auth Service Layer**: `backend/auth_services.py` isole login, inscription, session et mot de passe oublie.
- **Use Case / Interactor Pattern**: le nouveau domaine `Auth` est decoupe en actions unitaires dans `src/climaparc/auth/application/use_cases/`.
- **Hexagonal Architecture**: les use cases dependent d'interfaces de domaine; les acces base, session et courriel sont branches par des adapters d'infrastructure.
- **Repository Pattern**: `backend/repositories.py` isole les operations de persistence.
- **Database Gateway**: `backend/database.py` centralise connexion, SQL compatible SQLite/Postgres et helpers de securite.
- **Frontend Service Layer**: `frontend/api.js` isole les appels HTTP; `frontend/storage.js` isole le stockage local.
- **Frontend View Modules**: les vues lourdes quittent progressivement `app.js` vers `frontend/views/`.

Ce choix garde le deploiement actuel simple tout en separant les responsabilites pour audit et evolution.

## Organisation

```text
index.html             Charge l'interface et les couches frontend
app.js                 Shell UI, navigation et orchestration cote navigateur
styles.css             Styles de l'interface

frontend/
  api.js               Service API cote navigateur
  storage.js           Persistence locale cote navigateur
  views/
    dashboard.js       Vue Tableau de bord et widgets configurables
    reports.js         Vue Rapports et logique de presentation des rapports
    documents.js       Regles frontend de fichiers, types et limites d'upload
    recommendations.js Regles frontend d'affichage des recommandations
    places.js          Vues, formulaires et actions Lieux/Appartements
    users.js           Vues, formulaires et actions Utilisateurs/Acces

start.py               Selection controlee FastAPI ou serveur legacy
server.py              Serveur de retour temporaire pendant la transition

backend/
  database.py          Connexion DB, helpers SQL/JSON/password
  repositories.py      Lecture/ecriture etat, utilisateurs, equipements
  security.py          Filtrage du state, permissions et controle de scope
  services.py          Regles metier utilisateurs et equipements
  auth_services.py     Login, inscription, sessions et reinitialisation mot de passe
  file_storage.py      Upload, metadonnees, URLs signees et migration des anciens dataUrl
  state_compatibility.py Merge du state legacy et detection des collections modifiees

src/climaparc/
  main.py              Application FastAPI parallele, non activee comme serveur principal
  shared/domain/       Erreurs applicatives communes
  auth/
    application/
      commands.py      Entrees explicites des use cases Auth
      use_cases/       Une action Auth par fichier et par classe
    domain/            Protocols abstraits pour repositories, hash et courriel
    infrastructure/    Adapters DB, session, token, hash et SMTP
    presentation/      Router FastAPI et dependencies
  users/
    application/
      commands.py      Entrees explicites des use cases Utilisateurs
      use_cases/       Creation, modification et suppression d'utilisateur
    domain/            Protocols et policies de droits utilisateurs
    infrastructure/    Adapters state et auth utilisateur
    presentation/      Router FastAPI, dependencies et dispatch legacy
  places/
    application/
      commands.py      Entrees explicites des use cases Lieux/Appartements
      use_cases/       Creation et modification de lieux et appartements
    domain/            Protocols et policies de droits lieux
    infrastructure/    Adapters state et payload relationnel
    presentation/      Router FastAPI, dependencies et dispatch legacy
  equipment/
    application/
      commands.py      Entrees explicites des use cases Equipements
      use_cases/       Creation et modification de machines
    domain/            Protocols et policies de droits machines
    infrastructure/    Adapters state et table equipements
    presentation/      Router FastAPI, dependencies et dispatch legacy
  tickets/
    application/
      commands.py      Entrees explicites des use cases Demandes clients
      use_cases/       Creation et modification de demandes
    domain/            Protocols et policies de droits demandes
    infrastructure/    Adapters state et table tickets
    presentation/      Router FastAPI, dependencies et dispatch legacy
  work_orders/
    application/
      commands.py      Entrees explicites des use cases Bons de travail
      use_cases/       Creation et modification de BT
    domain/            Protocols et policies de droits BT
    infrastructure/    Adapters state et table work orders
    presentation/      Router FastAPI, dependencies et dispatch legacy
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

- `/api/login`, `/api/signup`, `/api/session`, `/api/logout`, `/api/password-reset/*`
- `/api/equipment`
- `/api/user`
- `/api/file-upload`, `/api/file-url`, `/api/file-delete`
- `/api/building`
- `/api/apartment`
- `/api/ticket`
- `/api/work-order`
- `/api/intervention`

Frontend deja separe:

- appels serveur dans `frontend/api.js`
- stockage local dans `frontend/storage.js`
- module Tableau de bord dans `frontend/views/dashboard.js`
- module Rapports dans `frontend/views/reports.js`
- module Documents dans `frontend/views/documents.js`
- module Recommandations dans `frontend/views/recommendations.js`
- module Lieux/Appartements dans `frontend/views/places.js`
- module Utilisateurs/Acces dans `frontend/views/users.js`

Auth deja prepare en architecture use case parallele:

- `CreateSessionUseCase`
- `ReadSessionUseCase`
- `LogoutSessionUseCase`
- `LoginUserUseCase`
- `SignupClientUseCase`
- `RequestPasswordResetUseCase`
- `ConfirmPasswordResetUseCase`

Les routes FastAPI correspondantes existent dans `src/climaparc/auth/presentation/router.py`. Le serveur legacy `server.py` reste le point de demarrage actuel jusqu'a la migration complete des autres domaines.

Utilisateurs deja migre vers use cases:

- `CreateUserUseCase`
- `UpdateUserUseCase`
- `DeleteUserUseCase`

Les endpoints legacy `/api/user` et `/api/user-delete` passent maintenant par ces use cases, tout en gardant les memes URLs et le meme format de reponse pour le frontend actuel.

Lieux/Appartements deja migre vers use cases:

- `CreateBuildingUseCase`
- `UpdateBuildingUseCase`
- `CreateApartmentUseCase`
- `UpdateApartmentUseCase`

Les endpoints legacy `/api/building` et `/api/apartment` passent maintenant par ces use cases. La suppression persistante d'appartement n'a pas encore d'endpoint public et reste hors de cette etape de refactor.

Equipements deja migre vers use cases:

- `CreateEquipmentUseCase`
- `UpdateEquipmentUseCase`

L'endpoint legacy `/api/equipment` passe maintenant par ces use cases. La regle existante qui preserve les pieces jointes d'une machine lors d'une modification sans `attachments` est conservee.

Demandes des clients deja migre vers use cases:

- `CreateTicketUseCase`
- `UpdateTicketUseCase`

L'endpoint legacy `/api/ticket` passe maintenant par ces use cases en conservant les memes controles de scope client et les memes payloads.

Bons de travail deja migre vers use cases:

- `CreateWorkOrderUseCase`
- `UpdateWorkOrderUseCase`

L'endpoint legacy `/api/work-order` passe maintenant par ces use cases. Les regles existantes sont conservees: admin/equipe interne peuvent gerer les BT, les techniciens peuvent modifier les BT qui leur sont assignes, et les clients ne peuvent pas creer/modifier les BT.

Le projet conserve encore un etat JSON central (`climaparc_state`) pour compatibilite. Les prochaines migrations recommandees sont:

1. `Demandes des clients`
2. `Bons de travail`
3. `Lieux / Appartements`
4. `Rappels`
5. `Documents`
6. Decoupage progressif de `app.js` en modules de vues par domaine (`dashboard`, `buildings`, `equipment`, `tickets`, `workOrders`, `interventions`, `documents`, `recommendations`, `users`, `settings`)

Chaque migration doit suivre le meme modele: service metier, repository dedie, puis controller fin.

## Securite et isolation des donnees

Le backend doit toujours appliquer les droits cote serveur, meme si l'interface cache deja certaines actions.

- `backend/security.py` filtre le state retourne selon `role`, `clientId`, `allowedBuildingIds` et `portalRights`.
- Les clients et techniciens ne recoivent pas le state global. Ils recoivent uniquement les clients, lieux, appartements, equipements, demandes, bons, interventions, documents et rappels autorises.
- `/api/state` est reserve aux profils `administrateur` et `equipe_interne` comme route de compatibilite temporaire.
- Les routes metier passent l'utilisateur courant a la couche applicative, qui applique le controle de scope. `Utilisateurs` utilise deja les use cases; les autres domaines utilisent encore les services legacy.
- Les mots de passe ne doivent jamais etre stockes dans `climaparc_state`, les payloads relationnels, les seeds publics ou les reponses API. Ils passent uniquement par la table d'authentification avec hash et sel.
- Les tokens de reinitialisation sont stockes dans `climaparc_password_reset_tokens`; le state ne garde que le suivi public de la demande.
- Les fichiers sont servis par URLs temporaires generees par le backend. La cle `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais etre exposee au navigateur.
- Les droits canoniques pour les recommandations sont `recommendations`, `recommendation_prices` et `recommendation_approve`. Les anciens noms `prices` et `approve_recommendations` ne sont acceptes que comme compatibilite de donnees existantes.

## Stockage des fichiers

Le stockage cible est Supabase Storage dans un bucket prive, par defaut `climaparc-documents`.

Le flux attendu:

```text
frontend/api.js -> POST /api/file-upload -> backend/file_storage.py -> Supabase Storage
frontend/api.js -> POST /api/file-url -> backend/file_storage.py -> URL temporaire signee
```

Les nouveaux fichiers ne doivent pas etre convertis en `dataUrl` ni sauvegardes en base64. Les metadonnees conservees sont: `id`, `name`, `fileName`, `fileType`, `fileSize`, `storageBucket`, `storagePath`, `clientId`, `buildingId`, `apartmentId`, `equipmentId`, `visibleToClient`, `uploadedAt` et `uploadedBy`.

Le fallback `local_uploads/` est reserve au developpement local quand Supabase Storage n'est pas configure. En production, l'absence de `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` bloque les nouveaux uploads.

## Normalisation de la base

Le modele relationnel applique progressivement la 3e forme normale:

- **1FN**: les listes et groupes repetes sont sortis du JSON vers des tables enfants.
- **2FN**: les tables de liaison utilisent une cle composee ou une cle dediee ou chaque attribut depend de toute la cle.
- **3FN**: les attributs descriptifs dependent de leur propre entite, pas d'un autre attribut non-cle.

Tables enfants normalisees ajoutees:

- `climaparc_building_contacts`: contacts sur place et facturation par lieu.
- `climaparc_work_order_technicians`: plusieurs techniciens par bon de travail.
- `climaparc_data_field_options`: options centralisees des champs de donnees.
- `climaparc_form_template_fields`: questions des formulaires.
- `climaparc_form_template_field_options`: options et branchements par question.
- `climaparc_role_permissions`: droits par role.
- `climaparc_intervention_responses`: reponses par intervention et question.
- `climaparc_intervention_response_values`: valeurs multiples d'une reponse.
- `climaparc_equipment_attachments`: fichiers rattaches a une machine.
- `climaparc_intervention_attachments`: fichiers rattaches a une intervention.
- `climaparc_recommendation_messages`: conversation autour d'une recommandation.

La colonne `payload` reste presente comme couche de compatibilite avec l'interface actuelle. Elle ne doit plus etre consideree comme le modele cible pour les rapports, filtres avances ou integrations futures. Les nouveaux rapports et recherches doivent lire prioritairement les tables normalisees.
