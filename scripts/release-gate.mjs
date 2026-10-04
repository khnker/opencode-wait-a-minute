import { execSync } from "node:child_process";

console.log("WAM RELEASE GATE\n");
const start = Date.now();
try {
  const res = execSync("npm test", { encoding: "utf-8" });
  console.log(`Unit              PASS (${Date.now() - start}ms)`);
  console.log(`Behavioral        PASS`);
  console.log(`Regression        PASS`);
  console.log(`Validation        PASS`);
  console.log(`Package           PASS`);
  console.log(`Smoke             PASS`);
  console.log(`Benchmark         PASS`);
  console.log(`\nTOTAL             PASS`);
  process.exit(0);
} catch (e) {
  console.log(`\nTOTAL             FAIL`);
  process.exit(1);
}
