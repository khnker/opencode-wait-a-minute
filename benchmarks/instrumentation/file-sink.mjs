import fs from "node:fs";
import path from "node:path";

export function createFileSink(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    write(counters) {
      fs.writeFileSync(
        path.join(dir, "counters.json"),
        JSON.stringify(counters, null, 2),
        "utf-8"
      );
    },
  };
}
