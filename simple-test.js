import { buildPrompt } from './src/context/prompt-engine.js';

const long = ('word '.repeat(1000)).trim();
const result = buildPrompt(
  { system: 'sys', context: long, user: 'question' },
  { maxTokens: 50 }
);

console.log('Result:');
console.log('truncated:', result.truncated);
console.log('totalTokens:', result.totalTokens);
console.log('parts:');
result.parts.forEach((p, i) => {
  console.log(`  ${i}: ${p.role} - length: ${p.content?.length || 0}, tokens: ${p.tokens || 'undefined'}`);
});
