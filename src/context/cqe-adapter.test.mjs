import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCqeTerms } from './cqe-adapter.js';
import { interpret } from '../../vendor/context-query-core/src/interpreter.js';

const PROMPT = `ahora los vendedores comercio pueden agregar clientes, pero maicol de gascarrasco
reporta que no puede agregar este usuario, analiza para ver que paso:
nombre: Jocelyn alvarez acosta
rut: 16554173-1
Giro: comida al paso
dirección: Pasaje el olivo 89 villa san jose
correo electronico: Jocelyn.33.1987@gmail.com`;

test('extractCqeTerms keeps domain terms and drops artifacts', () => {
  const terms = extractCqeTerms(PROMPT);
  for (const expected of ['vendedores', 'comercio', 'agregar', 'clientes']) {
    assert.ok(terms.includes(expected), `missing ${expected}: ${terms.join(',')}`);
  }
  assert.ok(!terms.some((t) => t.includes('@')), 'email leaked into terms');
  assert.ok(!terms.includes('16554173'), 'numeric id leaked into terms');
  assert.ok(!terms.includes('jocelyn'), 'proper noun leaked into terms');
  assert.ok(terms.length <= 8);
});

test('extractCqeTerms dedupes and respects the term cap', () => {
  const terms = extractCqeTerms('comercio comercio clientes vendedor facturacion inventario');
  assert.equal(terms.filter((t) => t === 'comercio').length, 1);
  assert.ok(extractCqeTerms('a b c d e f g h i j k', 3).length <= 3);
});

test('CGE interpret does not pick an email as the target name', () => {
  const result = interpret('analiza este usuario Jocelyn.33.1987@gmail.com');
  assert.notEqual(result.name, 'Jocelyn.33.1987@gmail.com');
  assert.ok(!String(result.name ?? '').includes('@'));
});

test('CGE interpret ignores numeric-only identifiers', () => {
  const result = interpret('revisa el rut 16554173-1 del cliente');
  assert.notEqual(result.name, '16554173-1');
});
