import {readFileSync,writeFileSync} from 'node:fs';
import {documentStudents,findStudents,extractIdeas} from '../src/lib/project-files/groups.ts';
const report=JSON.parse(readFileSync('output/proposal-audit/report.json'));
const before=JSON.parse(readFileSync('output/proposal-audit/before.json'));
const roster=before.groupData.find(x=>x.key==='roster').data;
for(const r of report){ if(!r.lines)continue;const members=documentStudents(r.lines); r.scan={members,ids:[...new Set([...findStudents(r.lines.join('\n'),roster),...members.map(x=>x.id)])],ideas:extractIdeas(r.lines)};console.log(report.indexOf(r),r.submitter,r.scan.ids.length,JSON.stringify(r.scan.ideas)); }
writeFileSync('output/proposal-audit/revised.json',JSON.stringify(report,null,2));
