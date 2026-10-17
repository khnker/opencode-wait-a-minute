import { emitTextPart } from './index.js';

const output = { message: { id: 'test', parts: [] } };
emitTextPart(output, 'Hello world', { phase: 'TEST' });
console.log('Parts:', output.message.parts);