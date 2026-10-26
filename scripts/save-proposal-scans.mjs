import {neon} from '@neondatabase/serverless';
import {readFileSync,writeFileSync} from 'node:fs';
import {cleanPlan,SCAN_VERSION,buildGroups} from '../src/lib/project-files/groups.ts';
const sql=neon(process.env.DATABASE_URL);
const report=JSON.parse(readFileSync('output/proposal-audit/revised.json'));
const files=[...new Set(report.map(x=>x.fileId))];
for(const fileId of files){
 const rows=report.filter(x=>x.fileId===fileId);
 if(rows.some(x=>x.scan.error))throw Error('Do not save incomplete scans');
 const live=await sql.query('select id,updated_at from project_entries where file_id=$1',[fileId]);
 if(live.length!==rows.length||live.some(e=>!rows.some(r=>r.id===e.id&&new Date(r.updatedAt).toISOString()===new Date(e.updated_at).toISOString())))throw Error('Submissions changed during audit; recheck required');
 const [saved]=await sql.query('select data,updated_at::text as updated_at from project_groups where key=$1',['plan:'+fileId]);
 writeFileSync('output/proposal-audit/plan-before-save.json',JSON.stringify(saved,null,2));
 const patch=Object.fromEntries(rows.map(r=>[r.id,{...r.scan,updatedAt:new Date(r.updatedAt).toISOString(),v:SCAN_VERSION}]));
 const validated=cleanPlan({scans:patch}).scans;
 if(process.argv.includes('--apply')){
   const changed=await sql.query("update project_groups set data=jsonb_set(data,'{scans}',coalesce(data->'scans','{}'::jsonb)||$1::jsonb), updated_at=now() where key=$2 and updated_at=$3::timestamptz returning key",[JSON.stringify(validated),'plan:'+fileId,saved.updated_at]);
   if(changed.length!==1)throw Error('Plan changed concurrently; save cancelled');
   const [after]=await sql.query('select data from project_groups where key=$1',['plan:'+fileId]);
   for(const key of Object.keys(saved.data))if(key!=='scans'&&JSON.stringify(saved.data[key])!==JSON.stringify(after.data[key]))throw Error('Unexpected change outside scans');
   if(rows.some(r=>JSON.stringify(after.data.scans[r.id].ids)!==JSON.stringify(validated[r.id].ids)))throw Error('Scan verification failed');
   console.log(JSON.stringify({saved:rows.length,version:SCAN_VERSION,manualSettingsPreserved:true}));
 }else console.log(JSON.stringify({ready:rows.length,version:SCAN_VERSION}));
}
