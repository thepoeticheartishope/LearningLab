// The experiments the menu lists. Each one lives in experiments/<id>/ with
// its own index.html and CARD.md, and never depends on another experiment.
// { id, name, status: 'building' | 'testing' | 'keep' | 'tweak' | 'kill' }
export const EXPERIMENTS = [
  { id: 'mastery', name: 'Mastery tiers', status: 'testing' },
];
