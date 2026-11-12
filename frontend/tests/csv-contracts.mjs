import { createServer } from 'vite';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({configFile:resolve('tests/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try{
 const {encodeCsv}=await server.ssrLoadModule('/src/lib/csvExport.ts');
 const header=['region','disease','target_date','cases','source_status'];
 const rows=[['Long, quoted "region"','Dengue','2025-01-01',0,'conditional'],['Unknown\nregion','ILI','2025-02-01',NaN,'provisional']];
 const text=encodeCsv(header,rows);
 assert.ok(text.includes('"Long, quoted ""region"""'));assert.ok(!text.includes('NaN'));assert.ok(text.includes(',0,conditional'));
 assert.throws(()=>encodeCsv(header,[[1]]),/column count/);
 await writeFile(process.argv[2],text,'utf-8');
 console.log('PASS: CSV column count, quotes/newlines, zero and unavailable values; fixture written for independent reimport.');
}finally{await server.close();}
