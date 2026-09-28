# AuraTask

Gestionnaire de tâches (React + Tauri) synchronisé en direct avec le panneau
Caelestia du bureau (**Super+Shift+T**) : les deux lisent et écrivent
`~/.local/share/auratask/tasks.json` via le script verrouillé
`scripts/tasks_store.py` (copié dans `~/.local/bin/auratask-tasks` pour le panneau).

## Lancer

```fish
npm install
npm run app:dev      # application native (Tauri) en développement
npm run dev          # version web sur http://localhost:3000
npm run app:build    # paquets .deb / .rpm / AppImage
```

L'IA Gemini est optionnelle : mettre `GEMINI_API_KEY` (et éventuellement
`GEMINI_MODEL`) dans `.env`. Sans clé, ou dans l'app native compilée, tout
fonctionne en local : analyse des dates en français, score d'urgence,
priorisation, rappels et briefing du jour.

## Saisie rapide

`Appeler Paul demain 14h30 !! #client @Travail 20min`

| Syntaxe | Effet |
| --- | --- |
| `aujourd'hui`, `demain`, `après-demain`, `lundi`…, `le 12/10`, `12 octobre`, `dans 3 jours`, `semaine prochaine`, `ce soir` | échéance |
| `à 14h`, `14h30`, `midi` | heure |
| `!!` / `urgent`, `!` / `!haute` / `important`, `!basse` | priorité |
| `#tag`, `@Catégorie`, `20min`, `pendant 2h` | tag, catégorie, durée |

Même syntaxe que dans le panneau Super+Shift+T pour `!!`, `!haute`, `!basse`,
`aujourd'hui` et `demain`.

## Raccourcis

| Touche | Action |
| --- | --- |
| `N` ou `Ctrl+K` | nouvelle tâche |
| `Q` | saisie rapide |
| `/` | rechercher |
| `1` … `6` | changer de vue |
| `Espace` | démarrer / suspendre le minuteur (vue Focus) |
| `Ctrl+Entrée` | enregistrer la tâche ouverte |
| `Échap` | fermer |
