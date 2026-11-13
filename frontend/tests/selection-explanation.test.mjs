import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/selectionExplanation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { selectionCard, explainSelectedText, explainTitle, headingTargets } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('definitions distinguish regional distribution from case counts and retain uncertainty caveats', () => {
  assert.match(explainSelectedText('Risk Distribution'), /regions, not the number of people/);
  assert.match(explainSelectedText('80% model interval'), /not been empirically calibrated/);
  assert.equal(explainSelectedText('123,456'), null);
});

test('only a single card without intersecting controls accepts a selection', () => {
  const previous = globalThis.Element;
  class ElementFixture {
    constructor(card, excluded = false) { this.card = card; this.excluded = excluded; }
    closest(selector) { return selector === headingTargets ? null : selector === '[data-text-card]' ? this.card : this.excluded ? this : null; }
  }
  globalThis.Element = ElementFixture;
  try {
    const control = {};
    const card = { querySelectorAll: () => [control] };
    const other = { querySelectorAll: () => [] };
    const range = { startContainer: new ElementFixture(card), endContainer: new ElementFixture(card), intersectsNode: () => false };
    assert.equal(selectionCard(range), card);
    assert.equal(selectionCard({ ...range, endContainer: new ElementFixture(other) }), null);
    assert.equal(selectionCard({ ...range, startContainer: new ElementFixture(card, true) }), null);
    assert.equal(selectionCard({ ...range, intersectsNode: () => true }), null);
    assert.equal(selectionCard({ ...range, startContainer: new ElementFixture(null) }), null);
  } finally { globalThis.Element = previous; }
});


test('titles have prepared explanations without AI, including non-glossary and dynamic titles', () => {
  for (const title of ['More details', 'Yearly rhythm', 'National reported aggregate', 'Platform Settings', 'Sources and unresolved interpretations', 'Central Visayas', 'Intervention recommendations']) {
    assert.ok(explainTitle(title).length > 40, title);
  }
  assert.match(explainTitle('Noise (residual)'), /irregular remainder/);
  assert.match(explainTitle('Highest illness risk'), /highest available individual/);
});

test('explicit title spans inside clickable headers allow partial selection outside marked cards', () => {
  const previous = globalThis.Element;
  class HeadingFixture {
    closest(selector) { return selector === headingTargets ? this : this; }
    matches(selector) { return selector === '[data-explain-title]'; }
  }
  globalThis.Element = HeadingFixture;
  try {
    const title = new HeadingFixture();
    const range = { startContainer: { parentElement: title }, endContainer: { parentElement: title } };
    assert.equal(selectionCard(range), title);
    assert.equal(selectionCard({ ...range, endContainer: { parentElement: null } }), null);
  } finally { globalThis.Element = previous; }
});


test('yearly rhythm and cycle indicators explain different charts with the correct units', () => {
  const rhythm = explainTitle('Yearly rhythm');
  const cycle = explainTitle('12-month cycle indicators');
  const acf = explainTitle('Autocorrelation Function (ACF)');
  assert.notEqual(rhythm, cycle);
  assert.notEqual(cycle, acf);
  assert.match(rhythm, /January to December/);
  assert.match(rhythm, /each bar averages/);
  assert.match(rhythm, /pooled burden references/);
  assert.match(cycle, /similarity score rather than a case count/);
  assert.match(cycle, /Missing months/);
  assert.match(cycle, /does not confirm an outbreak cycle/);
  assert.equal(explainTitle('  YEARLY RHYTHM  '), rhythm);
});
