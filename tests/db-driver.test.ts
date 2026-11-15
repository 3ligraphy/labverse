import test from 'node:test';
import assert from 'node:assert/strict';
import { driverFor } from '../src/lib/db-driver.ts';

test('Neon hosts use the Neon HTTP driver on Vercel; any other Postgres uses node-postgres', () => {
  assert.equal(driverFor('postgresql://u:p@ep-x-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require', true), 'neon');
  assert.equal(driverFor('postgresql://postgres.abc:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres', true), 'postgres');
  assert.equal(driverFor('postgres://avnadmin:p@pg-x.aivencloud.com:12345/defaultdb?sslmode=require', true), 'postgres');
  assert.equal(driverFor('postgresql://u:p@ep-x.neon.tech/db', false), 'postgres'); // laptops always use node-postgres
  assert.equal(driverFor('postgresql://u:p@evilneon.tech/db', true), 'postgres');
  assert.equal(driverFor('not a url', true), 'postgres');
});
