// Data check: is the facts data sound, and where does it need more facts?
// Reads every set in FACT_SETS (data/facts/<id>.json) and the Mastery
// evidence scenarios (experiments/mastery/scenarios.json).
//
//   Errors   — data the app will mishandle. Exit code 1.
//   Warnings — worth a look, nothing breaks.
//   Gaps     — where to add facts, by LEARNING-STYLE.md stage:
//              stage 2 needs 4+ entities of a type (close distractors),
//              stage 3 needs 2+ facts per term (related facts),
//              stage 4 needs a scenario per fact.
//
// Writes data/facts/GAPS.md and prints a summary.
// Usage: node tools/data-check.mjs   (npm run data)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FACT_SETS } from '../shared/config.js';
import { questionsFrom } from '../shared/facts.js';
import { factKey } from '../shared/termmap.js';
import { masteryKey } from '../experiments/mastery/mastery.js';

const SOURCE = /^\d{3}-\d{4} \d+\.\d+$/;   // "220-1201 3.2"
const MIN_TYPE = 4;                         // 1 right + 3 wrong in Recognition
const DEEP = 2;                             // facts a term needs for stage 3

const idOf = v => (typeof v === 'string' ? v : null);
const domainOf = src => (SOURCE.test(src || '') ? src.split(' ')[1].split('.')[0] : '?');

// Check one fact set. Returns { errors, warnings, gaps } with no output.
export function checkFactSet(data, scenarios = []) {
  const errors = [], warnings = [];
  const ents = data.entities || [], facts = data.facts || [], templates = data.templates || [];
  const byId = new Map();

  // Entities: unique ids; same name within a type is likely a slip.
  const seenName = new Map();
  for (const e of ents) {
    if (byId.has(e.id)) errors.push(`Entity id \`${e.id}\` is used twice.`);
    byId.set(e.id, e);
    const k = e.type + '|' + String(e.name).toLowerCase();
    if (seenName.has(k)) warnings.push(`Two ${e.type} entities named "${e.name}": \`${seenName.get(k)}\` and \`${e.id}\`.`);
    else seenName.set(k, e.id);
  }

  // Templates: one per predicate, and able to ask something.
  const tByPred = new Map();
  for (const t of templates) {
    if (tByPred.has(t.predicate)) errors.push(`Two templates for predicate \`${t.predicate}\`.`);
    tByPred.set(t.predicate, t);
    if (!t.ask_object && !t.ask_subject) errors.push(`Template \`${t.predicate}\` has no ask_object or ask_subject.`);
  }

  // Facts: template, source, no repeats. (Unknown ids are caught by npm test.)
  const keys = new Set(), predUsed = new Set();
  for (const f of facts) {
    const key = factKey(f);
    if (keys.has(key)) errors.push(`Fact \`${key}\` is listed twice.`);
    keys.add(key);
    predUsed.add(f.predicate);
    if (!tByPred.has(f.predicate)) errors.push(`Fact \`${key}\`: no template for predicate \`${f.predicate}\`.`);
    if (!f.source) errors.push(`Fact \`${key}\` has no source.`);
    else if (!SOURCE.test(f.source)) warnings.push(`Fact \`${key}\`: source "${f.source}" is not like "220-1201 3.2".`);
    if (f.role !== undefined && (typeof f.role !== 'string' || !f.role.trim())) errors.push(`Fact \`${key}\`: role must be words, like "data".`);
    else if (f.role && tByPred.has(f.predicate) && !tByPred.get(f.predicate).ask_object_role) {
      warnings.push(`Fact \`${key}\` has role "${f.role}", but template \`${f.predicate}\` has no ask_object_role, so no role question is made.`);
    }
  }
  for (const p of tByPred.keys()) if (!predUsed.has(p)) warnings.push(`Template \`${p}\` has no facts.`);

  // Facts per term (subject or entity object) — stage 3 depth.
  const perTerm = new Map();
  for (const f of facts) for (const id of [idOf(f.subject), idOf(f.object)]) {
    if (id && byId.has(id)) perTerm.set(id, (perTerm.get(id) || 0) + 1);
  }

  // Scenarios → terms. A scenario is its own written question (Mastery
  // matches question|answer), so tie it to a term by its answer's name.
  const byName = new Map();
  for (const e of ents) {
    const k = String(e.name).toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(e);
  }
  const qs = questionsFrom(data);
  const genKeys = new Set(qs.map(masteryKey));
  const scenTerms = new Set(), noFactYet = [], noTerm = [];
  for (const s of scenarios) {
    if (genKeys.has(masteryKey(s))) continue;   // replaces a generated row
    const hits = byName.get(String(s.answer).toLowerCase()) || [];
    hits.forEach(e => scenTerms.add(e.id));
    if (!hits.length) noTerm.push(s);
    else if (!hits.some(e => perTerm.has(e.id))) noFactYet.push(s);
  }

  // By entity type (the "areas"): how many entities, how many taught.
  const types = new Map();
  for (const e of ents) {
    const t = types.get(e.type) || { type: e.type, entities: 0, used: 0, facts: 0, deep: 0 };
    t.entities++;
    const n = perTerm.get(e.id) || 0;
    if (n) { t.used++; t.facts += n; }
    if (n >= DEEP) t.deep++;
    types.set(e.type, t);
  }

  // Answer types too small for 3 close wrong answers.
  const answerTypes = new Set();
  for (const f of facts) {
    const o = byId.get(idOf(f.object));
    if (o) answerTypes.add(o.type);
    if (tByPred.get(f.predicate)?.ask_subject) answerTypes.add(byId.get(f.subject)?.type);
  }
  const thinTypes = [...answerTypes].filter(Boolean)
    .map(t => types.get(t)).filter(t => t.entities < MIN_TYPE);

  // By objective (source).
  const objectives = new Map();
  for (const f of facts) {
    const o = objectives.get(f.source) || { source: f.source, facts: 0, scenarios: 0 };
    o.facts++; objectives.set(f.source, o);
  }
  for (const s of scenarios) {
    const o = objectives.get(s.source) || { source: s.source, facts: 0, scenarios: 0 };
    o.scenarios++; objectives.set(s.source, o);
  }

  const shallow = [...perTerm].filter(([, n]) => n < DEEP).map(([id]) => byId.get(id));
  return {
    errors, warnings,
    gaps: {
      counts: {
        entities: ents.length, facts: facts.length, templates: templates.length,
        termsUsed: perTerm.size, termsDeep: perTerm.size - shallow.length,
        withScenario: [...perTerm.keys()].filter(id => scenTerms.has(id)).length,
        scenarios: scenarios.length,
      },
      types: [...types.values()],
      thinTypes, shallow, noFactYet, noTerm,
      noScenario: [...perTerm.keys()].filter(id => !scenTerms.has(id)).map(id => byId.get(id)),
      objectives: [...objectives.values()],
      predicates: [...tByPred.keys()].map(p => ({ p, n: facts.filter(f => f.predicate === p).length })),
    },
  };
}

// The report for one set, as Markdown lines.
function report(id, { errors, warnings, gaps }) {
  const c = gaps.counts;
  const L = [`## ${id}`, '',
    `${c.facts} facts · ${c.entities} entities (${c.termsUsed} in a fact) · ${c.templates} templates · ${c.scenarios} scenarios`, ''];
  const list = (title, items) => { if (items.length) L.push(`### ${title} (${items.length})`, '', ...items.map(x => `- ${x}`), ''); };
  list('Errors', errors);
  list('Warnings', warnings);

  L.push('### By area (entity type)', '',
    'Untaught = entities with no fact. Shallow = taught terms with only 1 fact (thin stage 3).', '',
    '| Type | Entities | Taught | Untaught | Shallow | Facts |', '|---|---|---|---|---|---|');
  [...gaps.types].sort((a, b) => a.used - b.used || b.entities - a.entities || a.type.localeCompare(b.type))
    .forEach(t => L.push(`| ${t.type} | ${t.entities} | ${t.used} | ${t.entities - t.used} | ${t.used - t.deep} | ${t.facts} |`));
  L.push('');

  L.push('### By objective', '',
    '| Objective | Facts | Scenarios |', '|---|---|---|');
  [...gaps.objectives].sort((a, b) => String(a.source).localeCompare(String(b.source), undefined, { numeric: true }))
    .forEach(o => L.push(`| ${o.source} | ${o.facts} | ${o.scenarios} |`));
  const domains = new Set(gaps.objectives.filter(o => o.facts).map(o => domainOf(o.source)));
  L.push('', `Domains with facts: ${[...domains].sort().join(', ') || 'none'}.`, '');

  L.push('### By predicate', '', '| Predicate | Facts |', '|---|---|');
  [...gaps.predicates].sort((a, b) => a.n - b.n).forEach(x => L.push(`| \`${x.p}\` | ${x.n} |`));
  L.push('');

  list(`Stage 2 — answer types with under ${MIN_TYPE} entities (too few close distractors)`,
    gaps.thinTypes.map(t => `${t.type}: ${t.entities}`));
  list(`Stage 3 — taught terms with under ${DEEP} facts (add related facts)`,
    gaps.shallow.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
      .map(e => `${e.name} (\`${e.id}\`, ${e.type})`));
  list('Stage 4 — taught terms with no evidence scenario',
    gaps.noScenario.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
      .map(e => `${e.name} (\`${e.id}\`, ${e.type})`));
  list('Scenario ready, term has no fact yet (easy wins: add facts for these)',
    gaps.noFactYet.map(s => `${s.answer} — ${s.question} (${s.source})`));
  list('Scenarios whose answer is not an entity',
    gaps.noTerm.map(s => `${s.answer} — ${s.question} (${s.source})`));
  return L;
}

// Run it: node tools/data-check.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scenFile = 'experiments/mastery/scenarios.json';
  const scenarios = fs.existsSync(scenFile) ? JSON.parse(fs.readFileSync(scenFile, 'utf8')) : [];
  const out = ['# Data gaps', '', 'Made by `npm run data`. Do not edit by hand.', '',
    'Where to add facts, by LEARNING-STYLE.md stage. Errors fail the check.', ''];
  let errorCount = 0;
  for (const set of FACT_SETS) {
    const data = JSON.parse(fs.readFileSync(`data/facts/${set.id}.json`, 'utf8'));
    const r = checkFactSet(data, scenarios);
    out.push(...report(set.id, r));
    const c = r.gaps.counts;
    errorCount += r.errors.length;
    console.log(`${set.id}: ${c.facts} facts, ${c.termsUsed} of ${c.entities} entities taught.`);
    console.log(`  Stage 3: ${c.termsDeep} of ${c.termsUsed} terms have ${DEEP}+ facts.`);
    console.log(`  Stage 4: ${c.withScenario} of ${c.termsUsed} taught terms have a scenario.`);
    console.log(`  ${r.errors.length} errors, ${r.warnings.length} warnings.`);
    r.errors.forEach(e => console.log('  ERROR ' + e.replaceAll('`', '')));
  }
  fs.writeFileSync('data/facts/GAPS.md', out.join('\n'));
  console.log('Full report in data/facts/GAPS.md');
  if (errorCount) process.exitCode = 1;
}
