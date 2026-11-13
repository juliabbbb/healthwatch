import { createServer } from 'vite';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const point=(cases)=>({observation_status:cases===0?'zero_by_user_relayed_DOH_rule':'observed_positive',coverage_basis:'fixture',source_record_count:cases===0?0:1,index:0,year:2019,month:1,label:'2019-01',date:'2019-01-01',season:'dry',forecast:false,cases,lower:cases,upper:cases,raw:cases,adjusted:false});
globalThis.fetch=async (url)=>{
  const path=new URL(url,'http://localhost:8000');
  let payload={};
  if(path.pathname==='/regions')payload=[];
  else if(path.pathname==='/dashboard')payload=path.searchParams.get('disease')==='Influenza-like Illness'?
    {forecast_available:true,series:{NCR:[point(1000)]},availability:{'130000000':{source_status:'provisional',observed_months:90,history_available:true,forecast_available:true,last_observed:'2026-08-01'}},metrics:{},outbreak:[]}:
    path.searchParams.get('disease')==='Dengue'?
    {forecast_available:true,provenance:{run_id:'test-run',validation_status:'verified_local_operational'},series:{NCR:[point(3)],CAR:[point(100)]},thresholds:[{region:'National Capital Region',month:1,p50:2.9,p75:2.99},{region:'Cordillera Administrative Region',month:1,p50:200,p75:400}],metrics:{},outbreak:[]}:
    path.searchParams.get('disease')==='Typhoid Fever'?
    {forecast_available:true,series:{NCR:Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(2026,8+i,1));return {...point(10),index:i,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,label:d.toISOString().slice(0,7),forecast:true};})},thresholds:Array.from({length:12},(_,i)=>({region:'National Capital Region',month:i+1,p50:5,p75:i===8?8:20})),metrics:{},outbreak:[]}:
    {forecast_available:false,series:{},metrics:{},outbreak:[]};
  return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
};
const server=await createServer({configFile:resolve('tests/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try{
 const data=await server.ssrLoadModule('/src/lib/healthwatch/data.ts');await data.dataReady;
 const forecasts=data.forecastPoints('130000000','Typhoid Fever');
 assert.equal(forecasts.length,12);assert.equal(forecasts[0].label,'2026-09');assert.equal(forecasts.at(-1).label,'2027-08');
 assert.equal(forecasts[0].index,data.indexForYearMonth(2026,9));
 assert.equal(data.assessRegion('130000000','Typhoid Fever',forecasts[0].index).risk,'high');
 assert.equal(data.assessRegion('130000000','Typhoid Fever',forecasts[1].index).risk,'moderate');
 assert.equal(data.forecastPoints('130000000','Typhoid Fever',3).at(-1).label,'2026-11');
 assert.equal(data.assessRegion('130000000','all',forecasts[0].index).risk,'unavailable');
 assert.equal(data.forecastPoints('140000000','Typhoid Fever').length,0);
 assert.equal(data.decompose('130000000','Typhoid Fever',103).length,0);
 assert.deepEqual(data.recommendations(data.assessRegion('130000000','all',92)),[]);
 const raw=data.assessRegion('130000000','Dengue',0,'raw');
 const percapita=data.assessRegion('130000000','Dengue',0,'percapita');
 assert.equal(raw.dominantIllness.id,'Dengue');
 assert.ok(data.PRIMARY_AGGREGATE_DISEASES.includes(data.assessRegion('130000000','all',92).dominantIllness.id));
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
 const {buildExportData}=await server.ssrLoadModule('/src/lib/healthwatch/exportData.ts');
 const {encodeCsv}=await server.ssrLoadModule('/src/lib/csvExport.ts');
 for(const kind of ['comparison','forecast','timeseries']){
  const file=buildExportData(kind,['130000000'],'Dengue',0,'raw');
  assert.ok(file.rows.every(row=>row.length===file.header.length));
  assert.doesNotThrow(()=>encodeCsv(file.header,file.rows));
  if(file.rows.length){assert.equal(file.rows[0][file.header.indexOf('operational_run_id')],'test-run');assert.ok(file.header.includes('observation_status'));}
  if(kind==='forecast')assert.equal(file.rows.length,0); // Actual-only fixture must not become forecast rows.
 }
 console.log('PASS: own-region canonical risk; per-capita invariance; no stale-date substitution; unavailable display; population guard; explicit contributors; no summed interval.');
}finally{await server.close();}
