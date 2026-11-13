import { createServer } from 'vite';
import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { resolve } from 'node:path';
const server=await createServer({configFile:resolve('tests/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try {
  const {SurveillanceReportPDF}=await server.ssrLoadModule('/src/components/pdf/SurveillanceReportPDF.tsx');
  const risks=['low','moderate','high'];
  const regions=[0,1].map(i=>({
    profile:{code:`fixture${i}`,name:i?'Fixture with unavailable seasonal result':'Fixture with a deliberately long region label for export wrapping',short:`F${i}`,population:100000,density:10,classification:'Test only',island:'Test only'},
    risk:i?'unavailable':'high',reported:10,predicted:30,lower:20,upper:40,percentile:i?NaN:80,changePct:i?NaN:20,
    dominantIllness:'Synthetic fixture',unit:'cases/month',mape:25,mae:2,rmse:3,season:'dry',driver:'Synthetic export contract test',
    outbreak:i?undefined:{outbreak:true,trigger:'both',season:'dry',n_forecast_months:3,season_p75:12,season_avg:30},
    forecastWindow:Array.from({length:12},(_,m)=>({index:m,year:2025,month:m+1,label:`2025-${String(m+1).padStart(2,'0')}`,date:`2025-${String(m+1).padStart(2,'0')}-01`,season:m>=5&&m<=10?'wet':'dry',forecast:true,cases:10+m,lower:5+m,upper:15+m,raw:10+m,adjusted:false,canonicalRisk:i?'unavailable':risks[m%3]}))
  }));
  const options={layout:'comprehensive',baseline:'2025-01',generatedAt:'Synthetic QA fixture — 12 November 2026',pathology:'SYNTHETIC EXPORT TEST — NOT SURVEILLANCE DATA',mode:'raw',sections:{overview:true,comparative:true,trajectory:false,seasonality:false,performance:true,recommendations:false},regions};
  await renderToFile(React.createElement(SurveillanceReportPDF,{options}),process.argv[2]);
  console.log('Rendered actual application PDF component with synthetic parity fixture');
} finally {await server.close();}
