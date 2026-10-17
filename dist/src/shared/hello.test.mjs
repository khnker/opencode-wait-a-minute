import assert from 'node:assert/strict';
import { hello } from './hello.js';
assert.strictEqual(hello(), 'Hello, World!');
assert.strictEqual(typeof hello(), 'string');