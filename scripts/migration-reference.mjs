// Rebuild the expected application schema in disposable local PGlite.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { testDatabase } from '../tests/support/database.mjs';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/migration-reference.mjs OUTPUT.json');
const pg = await testDatabase();
try {
  const objects = (await pg.query(await readFile(new URL('./migration-catalog.sql', import.meta.url), 'utf8'))).rows;
  const migrations = [];
  for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    migrations.push({ name, sha256: createHash('sha256').update(await readFile(`supabase/migrations/${name}`)).digest('hex') });
  }
  await writeFile(output, JSON.stringify({ sha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), migrations, objects }, null, 2));
  console.log(JSON.stringify({ migrations: migrations.length, objects: objects.length, output }));
} finally { await pg.close(); }
