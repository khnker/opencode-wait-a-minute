export function createMigrationRunner(migrations) {
  const ordered = [...(migrations || [])].sort((a, b) => a.version - b.version);

  return {
    async run(from, to) {
      const applied = [];
      const skipped = [];
      for (const m of ordered) {
        if (m.version > from && m.version <= to) {
          const apply = m.up || m.apply;
          if (typeof apply === "function") {
            try {
              await apply();
            } catch (err) {
              throw new Error(
                `Migration ${m.version} failed: ${err?.message || err}`
              );
            }
          }
          applied.push(m.version);
        } else {
          skipped.push(m.version);
        }
      }
      return { applied, skipped };
    },
  };
}
