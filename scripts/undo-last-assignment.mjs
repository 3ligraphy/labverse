import {neon} from '@neondatabase/serverless';
import {readFileSync,writeFileSync} from 'node:fs';
const sql=neon(process.env.DATABASE_URL);
const original=JSON.parse(readFileSync('output/proposal-audit/before.json'));
const old=original.groupData.find(x=>x.key.startsWith('plan:'));
const [live]=await sql.query('select data,updated_at::text from project_groups where key=$1',[old.key]);
writeFileSync('output/proposal-audit/before-undo-assignment.json',JSON.stringify(live,null,2));
const additions=Object.entries(live.data.added??{}).flatMap(([key,ids])=>ids.filter(id=>!(old.data.added?.[key]??[]).includes(id)).map(id=>({group:key,id})));
console.log(JSON.stringify({undo:additions,restore:old.data.added}));
if(process.argv.includes('--apply')){
 if(additions.length!==5)throw Error('Live assignment no longer matches the action being restored');
 const changed=await sql.query("update project_groups set data=jsonb_set(data,'{added}',$1::jsonb),updated_at=now() where key=$2 and updated_at=$3::timestamptz returning data",[JSON.stringify(old.data.added),old.key,live.updated_at]);
 if(changed.length!==1)throw Error('Concurrent change; rollback cancelled');
 for(const k of Object.keys(live.data))if(k!=='added'&&JSON.stringify(changed[0].data[k])!==JSON.stringify(live.data[k]))throw Error('Unexpected unrelated change');
 console.log('Restored the saved membership state; all other plan data preserved.');
}
