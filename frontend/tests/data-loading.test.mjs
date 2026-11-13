import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('all original illness series load once, retain missing reports, and recover from failure', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'healthwatch-loading-'));
  const oldFetch = globalThis.fetch;
  const oldWarn = console.warn;
  try {
    const output = join(temp, 'data.cjs');
    const source = (await readFile(join(root, 'src/lib/healthwatch/data.ts'), 'utf8')).replace('import.meta.env?.["VITE_API_URL"]', JSON.stringify('http://fixture'));
    await writeFile(output, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
    const calls = [];
    let active = 0;
    let peak = 0;
    let failDisease = null;
    let data;
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      calls.push(url.pathname + url.search);
      active += 1;
      peak = Math.max(peak, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (url.pathname === '/regions') return { ok: true, json: async () => data.REGIONS };
        const disease = url.searchParams.get('disease');
        if (disease === failDisease) return { ok: false, status: 503 };
        const sample = disease === 'Typhoid Fever' ? 123 : disease === 'Influenza-like Illness' ? 456 : 10;
        const point = (year, month, cases, forecast = false) => ({ year, month, cases, raw: cases, lower: cases, upper: cases, forecast, date: year + '-' + String(month).padStart(2, '0') + '-01', label: year + '-' + String(month).padStart(2, '0'), adjusted: false });
        const historyEnd = disease === 'Acute Viral Hepatitis' ? point(2025, 9, sample) : point(2026, 8, sample);
        const series = Object.fromEntries(data.REGIONS.map((region) => [region.short, [point(2019, 1, disease === 'Cholera' && region.code === data.REGIONS[0].code ? null : sample), point(2019, 2, null), point(2019, 3, 0), historyEnd, point(2026, 9, sample + 1, true)]]));
        const availability = Object.fromEntries(data.REGIONS.map((region) => [region.code, { source_status: 'observed', history_available: true, forecast_available: true, observed_months: 92, first_observed: '2019-01-01', last_observed: historyEnd.date, required_observed_months: 24, forecast_start: '2026-09-01', forecast_end: '2026-09-01', reason_code: null, message: null }]));
        const thresholds = data.REGIONS.slice(0, 2).flatMap((region, regionIndex) => regionIndex === 1 && disease === 'Typhoid Fever' ? [] : [1, 3].map((month) => ({ region: region.name, region_code: region.code, month, p50: 5, p75: 20 })));
        return { ok: true, json: async () => ({ disease, thresholds, forecast_available: disease !== 'Heat-Related Illness', series: disease === 'Heat-Related Illness' ? {} : series, availability, metrics: {}, outbreak: [], annual_reference: disease === 'Heat-Related Illness' ? [{ year: 2024, canonical_region: data.REGIONS[0].name, province: 'Source province', illness: 'Heat Exhaustion', events: 1, cases: 23, deaths: 0 }] : undefined }) };
      } finally { active -= 1; }
    };
    data = createRequire(import.meta.url)(output);
    assert.equal(calls.length, 0, 'Importing data must not start an SSR or duplicate client fetch');
    const first = data.reloadHealthwatchData();
    assert.equal(first, data.reloadHealthwatchData(), 'Concurrent callers must share one in-flight batch');
    await first;
    assert.equal(calls.filter((url) => url.startsWith('/dashboard')).length, data.ILLNESSES.length + data.REFERENCE_ILLNESSES.length);
    assert.ok(peak <= 2, 'Limit simultaneous API requests');
    const region = data.REGIONS[0].code;
    assert.equal(data.seriesFor(region, 'Typhoid Fever')[0].cases, 123);
    assert.equal(data.seriesFor(region, 'Influenza-like Illness')[0].cases, 456);
    assert.ok(Number.isNaN(data.seriesFor(region, 'Influenza-like Illness')[1].cases), 'Missing source month must not become zero');
    const allJanuary = data.assessRegion(region, 'all', 0, 'raw');
    assert.equal(allJanuary.point.cases, 143, 'All must sum only available contributors');
    assert.deepEqual(allJanuary.point.contributors, ['Dengue', 'Acute Bloody Diarrhea', 'Typhoid Fever']);
    assert.equal(allJanuary.risk, 'high', 'A missing illness must not erase an available High tier');
    assert.equal(data.assessRegion(region, 'all', 0, 'percapita').risk, allJanuary.risk);
    assert.equal(data.assessRegion(data.REGIONS[1].code, 'all', 0, 'raw').risk, 'moderate', 'Missing thresholds must be excluded from the color rule');
    assert.equal(data.assessRegion(data.REGIONS[2].code, 'all', 0, 'raw').risk, 'unavailable', 'Unknown thresholds must never become Low');
    const allFebruary = data.assessRegion(region, 'all', 1, 'raw');
    assert.ok(Number.isNaN(allFebruary.point.cases));
    assert.equal(allFebruary.risk, 'unavailable', 'Entirely missing dates must remain unavailable');
    assert.equal(data.assessRegion(region, 'all', 2, 'raw').point.cases, 0);
    assert.equal(data.assessRegion(region, 'all', 2, 'raw').risk, 'low', 'Reported zero remains valid');
    assert.equal(data.nationalDominant('all', 0, 'raw').illness.id, 'Typhoid Fever');
    assert.ok(Number.isNaN(data.nationalDominant('all', 1, 'raw').cases));

    for (const disease of data.ILLNESSES.filter((item) => item.id !== 'Heat-Related Illness')) assert.ok(data.seriesFor(region, disease.id).some((point) => !point.forecast && Number.isFinite(point.cases)), disease.id);
    const lastHepA = data.indexForYearMonth(2025, 9);
    assert.equal(data.availableMonthForDisease('Acute Viral Hepatitis', data.indexForYearMonth(2026, 11)), lastHepA);
    assert.equal(data.latestReportedMonthForDisease('Dengue'), data.indexForYearMonth(2026, 8));
    assert.equal(data.heatReferenceForRegion(region)[0].cases, 23);
    assert.equal(data.heatReferenceForRegion(data.REGIONS[1].code).length, 0);
    const panelSource = await readFile(join(root, 'src/components/hw/HeatReferencePanel.tsx'), 'utf8');
    const panelCode = ts.transpileModule(panelSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const panelModule = { exports: {} };
    const localRequire = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', panelCode)((name) => name === '@/lib/healthwatch/data' ? data : localRequire(name), panelModule, panelModule.exports);
    const annualHtml = renderToStaticMarkup(createElement(panelModule.exports.HeatReferencePanel, { regionCode: region }));
    assert.match(annualHtml, /2024/);
    assert.match(annualHtml, />23</);
    assert.match(annualHtml, /annual source/);
    const absentHtml = renderToStaticMarkup(createElement(panelModule.exports.HeatReferencePanel, { regionCode: data.REGIONS[1].code }));
    assert.match(absentHtml, /No annual events are listed/);
    const snapshotSource = await readFile(join(root, 'src/components/hw/NationalSnapshot.tsx'), 'utf8');
    const snapshotCode = ts.transpileModule(snapshotSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const snapshotModule = { exports: {} };
    const stubs = {
      '@/lib/healthwatch/data': data,
      '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
      '@/utils/formatDate': { formatMonthYear: (value) => value },
      '@/hooks/useAudienceMode': { useAudienceMode: () => ({ mode: 'public' }) },
      './LiveClock': { LiveClock: () => null },
      './HeatReferencePanel': panelModule.exports,
      './ProvisionalTag': { ProvisionalTag: () => null },
      '@/components/hw/ProvisionalTag': { ProvisionalTag: () => null },
      '@tanstack/react-router': { Link: ({ children }) => createElement('a', {}, children) },
    };
    new Function('require', 'module', 'exports', snapshotCode)((name) => stubs[name] ?? localRequire(name), snapshotModule, snapshotModule.exports);
    const baseProps = { monthLabel: '2026-11', isForecast: false, value: NaN, mode: 'raw', illness: 'Acute Viral Hepatitis', counts: { high: 0, moderate: 0, low: 0, unavailable: 18 }, dominantIllness: 'Hepatitis A', dominantValue: 'Unavailable', dominantCases: 'Unavailable', dominantAvailable: false, valueKind: 'unavailable' };
    const emptySnapshot = renderToStaticMarkup(createElement(snapshotModule.exports.NationalSnapshot, baseProps));
    assert.match(emptySnapshot, /No data this month/);
    assert.match(emptySnapshot, /No available illness for this month/);
    assert.doesNotMatch(emptySnapshot, /Unavailable cases/);
    assert.match(emptySnapshot, /break-words/);
    const allSnapshot = renderToStaticMarkup(createElement(snapshotModule.exports.NationalSnapshot, { ...baseProps, illness: 'all', value: 143, dominantAvailable: true, dominantValue: '123', dominantCases: '123', dominantIllness: 'Typhoid Fever', valueKind: 'reported', counts: { high: 1, moderate: 1, low: 0, unavailable: 16 } }));
    assert.match(allSnapshot, /Highest illness risk/);
    assert.match(allSnapshot, /highest available individual tier/);
    assert.doesNotMatch(allSnapshot, /No data this month/);


    const completedCalls = calls.length;
    await data.ensureHealthwatchData();
    assert.equal(calls.length, completedCalls, 'The map must reuse the completed gate load');
    failDisease = 'Influenza-like Illness';
    console.warn = () => {};
    await assert.rejects(data.reloadHealthwatchData(), /Could not load reported data for Influenza-like Illness/);
    assert.equal(data.availabilityForRegion(region, failDisease).reason_code, 'request_failed');
    failDisease = null;
    await data.ensureHealthwatchData();
    assert.equal(data.availabilityForRegion(region, 'Influenza-like Illness').reason_code, null);
    assert.equal(data.seriesFor(region, 'Influenza-like Illness')[0].cases, 456);
  } finally {
    globalThis.fetch = oldFetch;
    console.warn = oldWarn;
    await rm(temp, { recursive: true, force: true });
  }
});
