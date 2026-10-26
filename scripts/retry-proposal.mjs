import {readFileSync,writeFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {readDocText} from '../output/proposal-audit/reader.mjs';
const w=new Window();globalThis.DOMParser=w.DOMParser;globalThis.location=w.location;
const b=JSON.parse(readFileSync('output/proposal-audit/before.json'));
const report=JSON.parse(readFileSync('output/proposal-audit/report.json'));
const row=report.find(x=>x.submitter==='Hatem Ahmed');
const e=b.entries.find(e=>e.id===row.id);
const result=await readDocText(e.url);Object.assign(row,result);writeFileSync('output/proposal-audit/report.json',JSON.stringify(report,null,2));console.log(result);
for(const name of ['Yahia Waleed','Habiba Mohammed Ibrahim']){const e=b.entries.find(x=>x.name===name);if(e.url.endsWith('.pdf')){const res=await fetch(e.url);writeFileSync('output/proposal-audit/'+e.student_id+'.pdf',Buffer.from(await res.arrayBuffer()));}}
