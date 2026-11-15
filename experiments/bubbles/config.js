// Bubble answers' settings.
export const BUBBLES = {
  roundSize: 8,
  choices: 4,
  // Per fact set (the picked one, shared/sets.js): `predicate` = only rows
  // made from these facts (both directions); `note` = shown after a wrong
  // tap, when the tapped answer is itself a fact of the predicate:
  // "Telnet uses port 23." A set not listed here uses all its rows, no note.
  sets: {
    'comptia-aplus': {
      predicate: 'uses_port',
      note: (name, value) => name + ' uses port ' + value + '.',
    },
  },
};
