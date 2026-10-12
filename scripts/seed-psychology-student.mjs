import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

if (process.env.VERCEL_ENV !== 'production') throw new Error('Production seed only.');
const hash = process.env.PSYCHOLOGY_STUDENT_HASH;
if (!/^s1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(hash ?? '')) throw new Error('A valid password hash is required.');
const sql = neon(process.env.DATABASE_URL);
const email = 'psychology.student@example.com';
const module = 'technology-for-psychology';
const existing = await sql.query('select password_hash from accounts_users where email=$1', [email]);
if (existing.length && existing[0].password_hash !== hash) throw new Error('Account already exists; refusing to change its password.');
await sql.transaction([
  sql.query(`insert into accounts_users (id,role,name,email,password_hash,student_id,year,specialization,modules,faculty)
    values ($1,'student','Psychology Demo Student',$2,$3,'PSY-DEMO-001','Year 2','Psychology',$4,'arts-humanities')
    on conflict (email) do nothing`, [randomUUID(), email, hash, [module]]),
  sql.query(`insert into accounts_enrollments (module,email,source,added_by)
    values ($1,$2,'staff','Requested student seed') on conflict do nothing`, [module, email]),
]);
const saved = await sql.query(`select u.email,u.role,u.active,u.faculty,e.module from accounts_users u
  join accounts_enrollments e on e.email=u.email where u.email=$1 and e.module=$2`, [email,module]);
if (saved.length !== 1 || saved[0].role !== 'student' || !saved[0].active) throw new Error('Student verification failed.');
console.log(JSON.stringify({studentSeeded:true, ...saved[0]}));
