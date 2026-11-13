// Read-only acceptance against the explicitly local app; never publishes data.
import { createServer } from 'vite';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8000';
const health = await (await fetch(`${base}/health`)).json();
assert.equal(health.shared_database, false);
assert.equal(health.model, 'SARIMAX');
assert.ok(health.snapshot_run_id);
const server = await createServer({configFile:resolve('tests/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try {
  const data = await server.ssrLoadModule('/src/lib/healthwatch/data.ts');
  await data.dataReady;
  let checked = 0;
  for (const illness of data.ILLNESSES) {
    const response = await fetch(`${base}/risk-classification/${encodeURIComponent(illness.id)}`);
    assert.equal(response.status, 200);
    const {items} = await response.json();
    for (const region of data.REGIONS) {
      const points = data.forecastPoints(region.code, illness.id);
      if (!points.length) continue;
      assert.equal(data.operationalModelForDisease(illness.id), 'SARIMAX');
      assert.equal(points.length, 12, `${illness.id}/${region.name} horizon`);
      for (const point of points) {
        const expected = items.find(row => row.region === region.name && row.date === point.date);
        assert.ok(expected, `${illness.id}/${region.name}/${point.date} classification missing`);
        const assessment = data.assessRegion(region.code, illness.id, point.index, 'raw');
        assert.equal(assessment.risk, expected.risk_level.toLowerCase());
        assert.equal(data.assessRegion(region.code, illness.id, point.index, 'percapita').risk, assessment.risk);
        assert.ok(Number.isFinite(assessment.point.cases));
        checked++;
      }
    }
  }
  assert.ok(checked > 1000);
  console.log(`PASS: ${checked} displayed forecast months match SARIMAX backend risk classifications; dates, point values, model identity and metric invariance verified.`);
} finally { await server.close(); }
