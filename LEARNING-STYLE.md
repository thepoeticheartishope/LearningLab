# Learning style

The five stages a fact moves through in the Lab. Each stage asks more of the
learner than the one before. Example fact: **HTTPS uses port 443**.

| # | Stage | What the learner does | Example |
|---|---|---|---|
| 1 | **Association** | Sees the term and the fact bound to a picture or sound (dual encoding), only when one exists. Nothing to answer yet. | "HTTPS — 443" with a padlock on a web page. |
| 2 | **Recognition** | Picks the right answer from a short list. | Which protocol uses port 443? HTTP · HTTPS · DNS · RDP |
| 3 | **Reinforcement** | Learns what the term *depends on*: the related facts that make it what it is. Builds a whole picture, not one line. | HTTPS is a web protocol · HTTPS encrypts traffic · HTTPS = HTTP + TLS |
| 4 | **Analysis** | Reads a scenario and finds the key details that point to the answer. | "A user's browser shows a padlock and the firewall log shows TCP 443." → HTTPS; evidence = padlock, 443 |
| 5 | **Free recall** | Types the answer with no help: no list, no hints. | Port for HTTPS? `443` |

## Rules
- Association shows a picture or sound only when the fact has one
  (`data/media/<entity-id>.svg` or `.mp3`). No media = show the term and fact alone.
- A fact climbs one stage at a time. A miss drops it back one stage.
- Stage 3 feeds stage 4: the related facts learned in Reinforcement are the
  clues the learner looks for in Analysis.
- Distractors in Recognition come from close neighbours (HTTP for HTTPS), not
  random terms.
- Experiments test one stage, or the move between stages, at a time.

## Where the Lab is now
| Stage | In the Lab |
|---|---|
| 1 Association | not built; media coverage tracked by `npm run media` → `data/media/COVERAGE.md` |
| 2 Recognition | mastery tier 1 (pick from 4) |
| 3 Reinforcement | not built (the S·P·O facts already hold the related facts) |
| 4 Analysis | mastery tier 2 (tap the evidence; 8 facts with a scenario) |
| 5 Free recall | mastery tier 3–4 (type it) |
