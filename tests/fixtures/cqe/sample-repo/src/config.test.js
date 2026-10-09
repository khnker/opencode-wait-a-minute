import test from "node:test";
import assert from "node:assert";
import { parseConfig } from "./config.js";

test("parseConfig parses key=value pairs", () => {
  assert.deepStrictEqual(parseConfig("a=1"), { a: "1" });
});
