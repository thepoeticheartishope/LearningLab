# Learning Lab

Small lab for testing learning-game mechanics one at a time, before any of
them goes into a game.

## Rules
- One experiment = one mechanic in its own folder (`experiments/<id>/`).
  Experiments never depend on each other.
- Shared parts only: fact data, question generator, answer log, menu (`shared/`).
- No art, story, progression or sound. Plain placeholder screens.
- An experiment reaches play-test in about one PR.
- Every experiment has a card (`experiments/CARD-TEMPLATE.md`), written before the build.

## Pipeline
idea → mockup → card → Lab build → play-test → verdict (keep / tweak / kill) → keep only → storyboard → game

## Layout
| Path | What |
|---|---|
| `index.html` | menu: experiments, fact sets, answer log export |
| `shared/factgen.js` | facts (entities + S·P·O facts + templates) → question rows |
| `shared/facts.js` | loads `data/facts/<id>.json` and generates its questions |
| `shared/log.js` | answer log in localStorage + JSON export |
| `data/facts/` | fact sets (CompTIA A+ Core 1 from DungeonCrawler) |
| `experiments/` | one folder per experiment |

## Run
```
npm run serve   # http://127.0.0.1:8001
npm test
```
Live: https://thepoeticheartishope.github.io/LearningLab/
