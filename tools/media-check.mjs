// Association check: which fact entities have a picture or sound?
// Media files live in data/media/ and are named by entity id:
//   data/media/<entity-id>.svg|png|webp   (picture)
//   data/media/<entity-id>.mp3|ogg|wav    (sound)
// Only entities used in a fact are checked (the others are never taught).
// Writes data/media/COVERAGE.md and prints a summary.
// Usage: node tools/media-check.mjs

import fs from 'node:fs';
import path from 'node:path';

const FACTS_DIR = 'data/facts';
const MEDIA_DIR = 'data/media';
const PICTURE = ['.svg', '.png', '.webp'];
const SOUND = ['.mp3', '.ogg', '.wav'];

const files = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR) : [];
const media = {};
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  const kind = PICTURE.includes(ext) ? 'picture' : SOUND.includes(ext) ? 'sound' : null;
  if (!kind) continue;
  const id = path.basename(f, path.extname(f));
  (media[id] ??= new Set()).add(kind);
}

const lines = ['# Media coverage', '',
  'Made by `npm run media`. Do not edit by hand.', '',
  'Association (stage 1) shows a picture or sound only when one exists.',
  'Add one as `data/media/<entity-id>.svg` (picture) or `.mp3` (sound).', ''];
let totalHave = 0, totalAll = 0;

for (const f of fs.readdirSync(FACTS_DIR).filter(f => f.endsWith('.json')).sort()) {
  const set = JSON.parse(fs.readFileSync(path.join(FACTS_DIR, f), 'utf8'));
  const byId = new Map(set.entities.map(e => [e.id, e]));
  const used = new Set();
  for (const fact of set.facts) {
    used.add(fact.subject);
    if (typeof fact.object === 'string' && byId.has(fact.object)) used.add(fact.object);
  }
  const rows = [...used].map(id => byId.get(id) ?? { id, name: id, type: '?' })
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const have = rows.filter(e => media[e.id]);
  const missing = rows.filter(e => !media[e.id]);
  totalHave += have.length; totalAll += rows.length;

  lines.push(`## ${f} — ${have.length} of ${rows.length} have media`, '');
  if (have.length) {
    lines.push('Have:', '', '| Entity | Id | Type | Media |', '|---|---|---|---|');
    for (const e of have) lines.push(`| ${e.name} | \`${e.id}\` | ${e.type} | ${[...media[e.id]].sort().join(' + ')} |`);
    lines.push('');
  }
  if (missing.length) {
    lines.push('Missing:', '', '| Entity | Id | Type |', '|---|---|---|');
    for (const e of missing) lines.push(`| ${e.name} | \`${e.id}\` | ${e.type} |`);
    lines.push('');
  }
}

const unused = Object.keys(media).filter(id =>
  !lines.some(l => l.includes(`\`${id}\``)));
if (unused.length) lines.push('## Media files with no matching fact entity', '',
  ...unused.sort().map(id => `- \`${id}\``), '');

fs.writeFileSync(path.join(MEDIA_DIR, 'COVERAGE.md'), lines.join('\n'));
console.log(`Media: ${totalHave} of ${totalAll} fact entities have a picture or sound.`);
console.log(`Missing: ${totalAll - totalHave}. Full list in ${MEDIA_DIR}/COVERAGE.md`);
if (unused.length) console.log(`Unmatched media files: ${unused.join(', ')}`);
