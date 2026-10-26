import { neon } from '@neondatabase/serverless';
import { writeFile, readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { findStudents, extractIdeas, cleanPlan, buildGroups, SCAN_VERSION } from '../src/lib/project-files/groups.ts';
const sql = neon(process.env.DATABASE_URL);
const files = await sql.query("select id,title,kind from project_files where kind='proposal'");
const entries = await sql.query("select e.id,e.file_id,e.student_id,e.name,e.group_name,e.note,e.url,e.updated_at from project_entries e join project_files f on f.id=e.file_id where f.kind='proposal' order by e.updated_at desc");
const groupData = await sql.query('select key,data,updated_at from project_groups');
await writeFile('output/proposal-audit/before.json',JSON.stringify({files,entries,groupData},null,2));
console.log(JSON.stringify({files,entries:entries.length,roster:groupData.find(x=>x.key==='roster')?.data.length}));
let source = await readFile('src/scripts/doc-text.ts','utf8');
const start = source.indexOf('export async function loadPdfjs()');
const end = source.indexOf('\n/**', start);
source = source.slice(0,start)+`export async function loadPdfjs() { return import('pdfjs-dist/legacy/build/pdf.mjs'); }\n`+source.slice(end);
await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src/scripts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:'output/proposal-audit/reader.mjs'});
const {readDocText}=await import('../output/proposal-audit/reader.mjs');
const window = new Window({url:'http://localhost/'});
globalThis.DOMParser=window.DOMParser; globalThis.location=window.location;
const roster=groupData.find(x=>x.key==='roster')?.data??[];
const report=[];
for(const e of entries){
 const result=await readDocText(e.url);
 const old=groupData.find(x=>x.key==='plan:'+e.file_id)?.data.scans?.[e.id];
 const scan='error' in result ? {ids:[],ideas:[],error:result.error} : {ids:findStudents(result.lines.join('\n'),roster),ideas:extractIdeas(result.lines)};
 report.push({id:e.id,fileId:e.file_id,submitter:e.name,studentId:e.student_id,group:e.group_name,updatedAt:e.updated_at,old,scan,...result});
 console.log(JSON.stringify({n:report.length,total:entries.length,name:e.name,members:scan.ids.length,ideas:scan.ideas,error:scan.error,addedIds:scan.ids.filter(x=>!old?.ids.includes(x)),addedIdeas:scan.ideas.filter(x=>!old?.ideas.includes(x))}));
 await writeFile('output/proposal-audit/report.json',JSON.stringify(report,null,2));
}
