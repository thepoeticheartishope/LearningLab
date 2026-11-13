// Bubble answers' settings.
export const BUBBLES = {
  set: 'comptia-aplus',      // fact set
  predicate: 'uses_port',    // only rows made from these facts (both directions)
  roundSize: 8,
  choices: 4,
  // The note shown after a wrong tap, when the tapped answer is itself a
  // fact of the predicate: "Telnet uses port 23."
  note: (name, value) => name + ' uses port ' + value + '.',
};
