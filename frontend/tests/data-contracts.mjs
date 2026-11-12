import { createServer } from 'vite';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const point=(cases)=>({index:0,year:2019,month:1,label:'2019-01',date:'2019-01-01',season:'dry',forecast:false,cases,lower:cases,upper:cases,raw:cases,adjusted:false});
globalThis.fetch=async (url)=>{
  const path=new URL(url,'http://localhost:8000');
  let payload={};
  if(path.pathname==='/regions')payload=[];
  else if(path.pathname==='/dashboard')payload=path.searchParams.get('disease')==='Influenza-like Illness'?
    {forecast_available:true,series:{NCR:[point(1000)]},availability:{'130000000':{source_status:'provisional',observed_months:90,history_available:true,forecast_available:true,last_observed:'2026-08-01'}},metrics:{},outbreak:[]}:
    path.searchParams.get('disease')==='Dengue'?
    {forecast_available:true,series:{NCR:[point(3)],CAR:[point(100)]},thresholds:[{region:'National Capital Region',month:1,p50:2.9,p75:2.99},{region:'Cordillera Administrative Region',month:1,p50:200,p75:400}],metrics:{},outbreak:[]}:
    {forecast_available:false,series:{},metrics:{},outbreak:[]};
  return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
};
const server=await createServer({configFile:resolve('tests/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try{
 const data=await server.ssrLoadModule('/src/lib/healthwatch/data.ts');await data.dataReady;
 const raw=data.assessRegion('130000000','Dengue',0,'raw');
 const percapita=data.assessRegion('130000000','Dengue',0,'percapita');
 assert.equal(raw.risk,'high');assert.equal(percapita.risk,'high');
 assert.equal(data.assessRegion('140000000','Dengue',0,'raw').risk,'low');
 const absent=data.assessRegion('130000000','Dengue',90,'raw');
 assert.equal(absent.risk,'unavailable');assert.ok(Number.isNaN(absent.changePct));assert.ok(Number.isNaN(absent.percentileRank));assert.ok(Number.isNaN(absent.value));assert.equal(absent.point.year,2026);
 assert.equal(data.formatMetric(NaN,'raw'),'Unavailable');
 const partial=data.summarizeRegionalValues([raw,absent]);
 assert.equal(partial.cases,3);assert.equal(partial.reportingRegions,1);assert.ok(Number.isFinite(partial.per100k));
 assert.ok(Number.isNaN(data.summarizeRegionalValues([absent]).cases));
 assert.ok(Number.isNaN(data.nationalDominant('Dengue',90,'raw').cases));
 assert.ok(Number.isNaN(data.metricValue(5,{population:0},'percapita')));
 const all=data.getSeries('130000000','all')[0];
 assert.deepEqual(all.contributors,['Dengue']);assert.ok(Number.isNaN(all.lower));assert.ok(Number.isNaN(all.upper));
 assert.equal(all.cases,3);assert.equal(data.getSeries('130000000','Influenza-like Illness')[0].cases,1000);
 assert.equal(data.availabilityForRegion('130000000','Influenza-like Illness').source_status,'provisional');
 assert.equal(data.ILLNESS_BY_ID['Influenza-like Illness'].forecastAvailable,true);
 console.log('PASS: own-region canonical risk; per-capita invariance; no stale-date substitution; unavailable display; population guard; explicit contributors; no summed interval.');
}finally{await server.close();}
