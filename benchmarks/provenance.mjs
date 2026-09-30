import { execFileSync } from "node:child_process";
export function resolveProvenance() {
  try {
    const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: "pipe" }).trim();
    if (gitSha === "HEAD") throw new Error("Git returned HEAD literal");
    const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", stdio: "pipe" }).trim() !== "";
    return { gitSha, dirty, resolvedAt: new Date().toISOString() };
  } catch (e) {
    return { gitSha: "unknown", dirty: true, resolvedAt: new Date().toISOString() };
  }
}
