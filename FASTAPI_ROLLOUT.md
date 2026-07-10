# Exploitation FastAPI et fallback

## État actuel

FastAPI est le serveur principal de ClimaParc en production.

```text
python start.py
CLIMAPARC_SERVER_MODE=fastapi
```

`start.py` lance Uvicorn avec `src.climaparc.main:app`, le port fourni par
Render et les en-têtes proxy adaptés.

Le service Render, l'URL publique et la base Supabase restent inchangés.

## Fallback legacy

Le serveur historique est conservé temporairement pour permettre un retour
rapide:

```text
python start.py
CLIMAPARC_SERVER_MODE=legacy
```

Le mode legacy lance `server.py`. Il ne doit pas être configuré comme mode
normal de production et ne doit pas recevoir de nouvelles fonctionnalités.

## Procédure de bascule

### FastAPI vers legacy

1. Ouvrir le Web Service dans Render.
2. Ouvrir `Environment`.
3. modifier `CLIMAPARC_SERVER_MODE` vers `legacy`;
4. enregistrer et attendre le redémarrage;
5. vérifier `/api/health` et les fonctions critiques.

### Legacy vers FastAPI

1. remettre `CLIMAPARC_SERVER_MODE=fastapi`;
2. conserver `Start Command: python start.py`;
3. vérifier `/api/health`;
4. tester les parcours critiques;
5. consulter les logs Render.

## Conditions de suppression du fallback

`server.py` et `backend/legacy_*` pourront être supprimés seulement après:

- une période de production FastAPI stable;
- validation des parcours client, technicien et interne;
- suppression de la dépendance fonctionnelle à `/api/state`;
- migration des lectures/écritures restantes hors `climaparc_state`;
- procédure de restauration basée sur un déploiement Git connu.

Jusqu'à cette étape, le fallback reste du code de compatibilité isolé.

## Avancement de la consolidation de persistance

La migration applicative FastAPI/use cases est terminée. La phase suivante,
déjà commencée, consiste à retirer progressivement les écritures dépendantes de
`climaparc_state`.

Domaines consolidés partiellement:

- `settings` / `Paramètres`: les sauvegardes et suppressions passent par les
  tables relationnelles/payload du domaine; `climaparc_state` n'est plus
  réécrit pour ces opérations.
- `reminders` / `Rappels`: les créations, mises à jour, sauvegardes en lot et
  suppressions passent par `climaparc_reminders`; `climaparc_state` n'est plus
  réécrit pour ces opérations.
- `equipment` / `Équipements`: les créations et mises à jour passent par
  `climaparc_equipment` et les pièces jointes normalisées; `climaparc_state`
  n'est plus réécrit pour ces opérations.
- `places` / `Lieux et appartements`: les créations et mises à jour passent par
  `climaparc_buildings`, `climaparc_apartments` et les contacts normalisés;
  `climaparc_state` n'est plus réécrit pour ces opérations.
- `tickets` / `Demandes clients`: les créations et mises à jour passent par
  `climaparc_tickets`; `climaparc_state` n'est plus réécrit pour ces
  opérations.
