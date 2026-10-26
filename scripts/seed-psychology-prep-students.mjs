// Seeds the Psychology Prep Year students (groups A-1, A-2, S1 2026/27) and enrols them in Technology for Psychology.
//   node --env-file=.env.local scripts/seed-psychology-prep-students.mjs <roster.txt> <out.json>                       dry run
//   node --env-file=.env.local scripts/seed-psychology-prep-students.mjs <roster.txt> <out.json> --confirm-production  writes accounts_*
// roster.txt is `pdftotext -layout` of the SIS "Students Groups Report"; out.json receives the plain passwords (keep it private).
import { randomInt, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { hashPassword, verifyPassword } from '../src/lib/accounts/tokens.ts';

const [rosterFile, outFile] = process.argv.slice(2);
const production = process.argv.includes('--confirm-production');
if (!rosterFile || !outFile) throw new Error('Usage: <roster.txt> <out.json> [--confirm-production]');
const module = 'technology-for-psychology';

let group = '';
const students = [];
for (const line of readFileSync(rosterFile, 'utf8').split(/\r?\n/)) {
  const g = line.match(/Group\s*:\s*(\S+)/);
  if (g) group = g[1];
  const s = line.match(/^\s*\d+\s+(\d{6})\s+(.+?)\s*$/);
  if (s) students.push({ group, studentId: s[1], name: s[2].replace(/\s+/g, ' ') });
}
if (new Set(students.map((s) => s.studentId)).size !== students.length) throw new Error('Duplicate student IDs in roster.');

// no look-alike characters (0/O, 1/l/I) so the printed passwords are easy to type
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const password = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

// reuse passwords from an earlier run so a re-run never hands out different ones
const previous = existsSync(outFile) ? new Map(JSON.parse(readFileSync(outFile, 'utf8')).map((s) => [s.studentId, s.password])) : new Map();
for (const s of students) {
  const first = s.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
  s.username = `${first}${s.studentId}`;
  s.email = `${s.username}@bue.edu.eg`;
  s.password = previous.get(s.studentId) ?? password();
}
writeFileSync(outFile, JSON.stringify(students, null, 2));
const counts = Object.fromEntries([...new Set(students.map((s) => s.group))].map((g) => [g, students.filter((s) => s.group === g).length]));

if (!production) {
  console.log(JSON.stringify({ dryRun: true, total: students.length, groups: counts, sample: students.slice(0, 3).map(({ password, ...s }) => s) }, null, 2));
  process.exit(0);
}

const url = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_PRODUCTION or DATABASE_URL.');
const { neon } = await import('@neondatabase/serverless');
const sql = neon(url);

const emails = students.map((s) => s.email);
const taken = await sql.query('select email, student_id, password_hash from accounts_users where email = any($1) or student_id = any($2)', [emails, students.map((s) => s.studentId)]);
for (const row of taken) {
  const s = students.find((x) => x.email === row.email);
  if (!s || !verifyPassword(s.password, row.password_hash)) throw new Error(`${row.email} (${row.student_id}) already exists with another password; refusing to change it.`);
}

await sql.transaction(students.flatMap((s) => [
  sql.query(`insert into accounts_users (id,role,name,email,password_hash,student_id,year,specialization,modules,faculty)
    values ($1,'student',$2,$3,$4,$5,'Prep year','Psychology',$6,'arts-humanities') on conflict (email) do nothing`,
    [randomUUID(), s.name, s.email, hashPassword(s.password), s.studentId, [module]]),
  sql.query(`insert into accounts_enrollments (module,email,source,added_by) values ($1,$2,'staff',$3) on conflict do nothing`,
    [module, s.email, `Psychology Prep Year roster, group ${s.group}`]),
]));

const saved = await sql.query(`select u.email, u.password_hash from accounts_users u join accounts_enrollments e on e.email = u.email
  where u.email = any($1) and e.module = $2 and u.role = 'student' and u.active`, [emails, module]);
const ok = saved.filter((r) => verifyPassword(students.find((s) => s.email === r.email).password, r.password_hash)).length;
if (ok !== students.length) throw new Error(`Verification failed: ${ok}/${students.length} accounts sign in with their password.`);
console.log(JSON.stringify({ seeded: true, total: ok, groups: counts, module }));
