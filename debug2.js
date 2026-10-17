import { buildPrompt } from './src/context/prompt-engine.js';
import { countTokens } from './src/context/tokenizer.js';

const long = ('word '.repeat(1000)).trim(); // ~1000 tokens of context
console.log('long tokens:', countTokens(long));

// Let's copy the algorithm and add logging
const maxTokens = 50;
const reservedForUser = 0;

const parts = [];
if ('sys') parts.push({ role: 'system', content: 'sys' });
if (long) parts.push({ role: 'context', content: long });
if ('question') parts.push({ role: 'user', content: 'question' });

const contentFor = (p) => (typeof p.content === 'string' ? p.content : '');

const withTokens = parts.map((p) => ({ ...p, tokens: countTokens(contentFor(p)) }));
console.log('withTokens:', withTokens);
const totalTokens = withTokens.reduce((s, p) => s + p.tokens, 0);
console.log('totalTokens:', totalTokens);

if (totalTokens <= maxTokens) {
  console.log('under budget');
} else {
  console.log('over budget');
  const priorities = ['user', 'context'];
  const resultParts = withTokens.map((p) => ({
    role: p.role,
    content: p.content,
    tokens: p.tokens,
  }));
  console.log('resultParts:', resultParts);

  let currentTokens = totalTokens;
  console.log('starting currentTokens:', currentTokens);
  for (const role of priorities) {
    if (currentTokens <= maxTokens) break;
    const idx = resultParts.findIndex((p) => p.role === role);
    console.log('role:', role, 'idx:', idx);
    if (idx === -1) continue;
    const part = resultParts[idx];
    console.log('part before:', part);
    const remainingBudget = maxTokens - (currentTokens - part.tokens);
    console.log('remainingBudget:', remainingBudget);
    const minForUser = role === 'user' ? reservedForUser : 0;
    console.log('minForUser:', minForUser);
    const allowed = Math.max(0, remainingBudget - minForUser);
    console.log('allowed:', allowed);
    if (allowed >= part.tokens) {
      console.log('allowed >= part.tokens, skipping');
      continue;
    }
    if (allowed === 0) {
      part.content = '';
      part.tokens = 0;
      console.log('set to empty');
    } else {
      // Truncate content by approximate char ratio (chars ~= 4 chars per token).
      const charBudget = allowed * 4;
      let truncated = contentFor(part).slice(0, charBudget);
      if (contentFor(part).length > charBudget) {
        truncated += '...';
      }
      part.content = truncated;
      part.tokens = countTokens(part.content);
      console.log('after truncation:', part);
    }
    // Update the part in resultParts and adjust currentTokens
    const oldTokens = resultParts[idx].tokens;
    resultParts[idx] = part;
    currentTokens = currentTokens - oldTokens + part.tokens;
    console.log('oldTokens:', oldTokens, 'newTokens:', part.tokens, 'currentTokens now:', currentTokens);
  }

  console.log('final resultParts:', resultParts);
  console.log('final currentTokens:', currentTokens);
}
