// Mastery's settings (copied from DungeonCrawler js/config.js MASTERY, v416).
export const MASTERY = {
  bar: 5,             // credits on a tier that move a fact up
  bets: [1, 2, 3],    // Low / Medium / High; the bet is optional and none counts as the first
  // How long a fact rests after it reaches a tier (by the tier reached):
  // this many other questions AND days must both pass. A Mastered fact
  // that passes its check rests this times (checks passed + 1).
  rests: {
    2: { questions: 3, days: 1 },
    3: { questions: 6, days: 3 },
    4: { questions: 15, days: 7 },
  },
  activeFacts: 6,     // a new fact joins only while fewer unmastered facts than this are ready
  logMax: 500,        // answers kept in the record's own log (each with its bet), newest last
  storageKey: 'learninglab.mastery.', // + 'record.' / 'picked.' + the set id
};

// The fact set this experiment runs on, and its hand-written rows with
// evidence scenarios (scenarios.json, from DungeonCrawler's A+ list).
export const MASTERY_SET = 'comptia-aplus';
