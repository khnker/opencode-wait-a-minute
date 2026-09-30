export const COUNTER_NAMES = [
  "Context_assembled",
  "Context_reconstructed",
  "Context_fast_path",
  "Snapshot_hit",
  "Snapshot_miss",
  "Mandatory_items",
  "Conditional_items",
  "Optional_items",
  "Tokens_before",
  "Tokens_after",
  "Reconstruction_count",
];

export function createCollector() {
  const counters = Object.fromEntries(COUNTER_NAMES.map((name) => [name, 0]));

  return {
    record(name, value = 1) {
      if (COUNTER_NAMES.includes(name)) {
        counters[name] += value;
      }
    },
    set(name, value) {
      if (COUNTER_NAMES.includes(name)) {
        counters[name] = value;
      }
    },
    snapshot() {
      return { ...counters };
    },
    reset() {
      for (const name of COUNTER_NAMES) {
        counters[name] = 0;
      }
    },
  };
}
