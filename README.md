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

Learning style (the five stages a fact moves through): `LEARNING-STYLE.md`.

## Pipeline
idea → mockup → card → Lab build → play-test → verdict (keep / tweak / kill) → keep only → storyboard → game

## Layout
| Path | What |
|---|---|
| `index.html` | menu: experiments, fact sets, answer log export |
| `shared/factgen.js` | facts (entities + S·P·O facts + templates) → question rows |
| `shared/facts.js` | loads `data/facts/<id>.json` and generates its questions |
| `shared/log.js` | answer log in localStorage + JSON export |
| `shared/choices.js` | multiple-choice options for a question row |
| `shared/bubbles.js` | floating answer bubbles: `mountBubbles(el, { answers, onPick })` → `{ mark, dim, setAnswers, setCalm, destroy }` |
| `shared/bubblephysics.js` | the bubbles' movement maths (no DOM); optional springs for the map |
| `shared/termmap.js` | a term's bubble map from the facts (no DOM; the term and its own links only): `mapFor(entityId, facts, templates, unlocked)`; a template's `map` entry = its line label and colour |
| `shared/bubblemap.js` | the bubble map on a canvas: `mountBubbleMap(el, { map, onPick })` → `{ setMap, select, mark, destroy }` |
| `data/facts/` | fact sets (CompTIA A+ Core 1 from DungeonCrawler) |
| `data/media/` | pictures/sounds by entity id; `COVERAGE.md` = which have one |
| `tools/media-check.mjs` | `npm run media`: rebuilds `data/media/COVERAGE.md` |
| `experiments/` | one folder per experiment |
| `experiments/mastery/` | experiment 1: mastery tiers (pick → evidence → type → rest); tier 1 answers as bubbles or buttons; Map tab = bubble map of the facts past Recognition |
| `experiments/bubbles/` | experiment 2: bubble answers vs plain buttons (port facts, modes alternate per round) |

## Run
```
npm run serve   # http://127.0.0.1:8001
npm test
npm run media   # which fact entities have a picture or sound
```
Live: https://thepoeticheartishope.github.io/LearningLab/
