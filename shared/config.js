// Settings shared by every experiment. Each experiment keeps its own
// settings in its own folder; only what the shared parts need lives here.

// Generated questions (factgen.js): the category and difficulty a template
// leaves out; made-up wrong numbers (madeUpCount of them, within
// madeUpSpread of the right one); an open-list row needs openMinWrong
// wrong answers from its own file.
export const FACT_QUESTIONS = {
  category: 'Facts', difficulty: 'medium',
  madeUpSpread: 0.25, madeUpCount: 3, openMinWrong: 3,
};

// The fact sets the Lab knows: id → file under data/facts/.
export const FACT_SETS = [
  { id: 'comptia-aplus', name: 'CompTIA A+ Core 1' },
];

// The answer log in localStorage.
export const LOG_KEY = 'learninglab.log.v1';
