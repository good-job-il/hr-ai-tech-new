"""Read-only HR-6 audit. Emits schema and aggregate counts, never personal rows.

Usage: python3 scripts/audit-migration.py REFERENCE.json OUTPUT.json
Requires psql and the existing linked Supabase/.env.local configuration.
"""
import collections
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'rnstsczayhzrxzcstzpr'

def ident(value):
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def main():
    reference = json.loads(Path(sys.argv[1]).read_text())
    env = os.environ.copy()
    local = dict(line.split('=', 1) for line in (ROOT / '.env.local').read_text().splitlines() if '=' in line and not line.startswith('#'))
    pool = urlsplit((ROOT / 'supabase/.temp/pooler-url').read_text().strip())
    assert (ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET
    assert pool.username == 'postgres.' + TARGET
    assert TARGET in local['NEXT_PUBLIC_SUPABASE_URL']
    env.update(PGPASSWORD=local['NEXT_SUPABASE_DB_PASS'].strip('\"\''), PGSSLMODE='require', PGCONNECT_TIMEOUT='15', PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000')
    command = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', pool.hostname, '-p', str(pool.port), '-U', pool.username, '-d', 'postgres']
    def query(sql):
        # Every call is explicitly read-only; stdout contains only the selected JSON.
        result = subprocess.run(command, input='begin isolation level repeatable read read only;\n'+sql+'\ncommit;', text=True, capture_output=True, env=env)
        if result.returncode:
            # Do not propagate arbitrary server errors that might quote real records.
            raise RuntimeError('Read-only database query failed; no server detail emitted')
        return json.loads(result.stdout)
    def rows(sql):
        return query('select coalesce(json_agg(q),\'[]\'::json) from ('+sql.rstrip(';\n')+') q;')
    objects = rows((ROOT / 'scripts/migration-catalog.sql').read_text())
    tables = [o['key'] for o in objects if o['kind'] == 'tables']
    counts = rows(' union all '.join('select '+literal(t)+' as table_name,count(*) as rows from '+'.'.join(map(ident,t.split('.'))) for t in tables))
    fks = rows("""select c.conname,n.nspname child_schema,t.relname child_table,pn.nspname parent_schema,p.relname parent_table,c.convalidated,
      (select json_agg(json_build_object('child',a.attname,'parent',b.attname) order by k.ord)
       from unnest(c.conkey,c.confkey) with ordinality k(ca,pa,ord)
       join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.ca
       join pg_attribute b on b.attrelid=c.confrelid and b.attnum=k.pa) columns
      from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
      join pg_class p on p.oid=c.confrelid join pg_namespace pn on pn.oid=p.relnamespace
      where c.contype='f' and (n.nspname='public' or (n.nspname='auth' and t.relname='identities'))""")
    checks = []
    for fk in fks:
        cols = fk['columns']
        child = ident(fk['child_schema'])+'.'+ident(fk['child_table'])
        parent = ident(fk['parent_schema'])+'.'+ident(fk['parent_table'])
        predicate = ' and '.join('c.'+ident(c['child'])+' is not null' for c in cols)
        join = ' and '.join('p.'+ident(c['parent'])+'=c.'+ident(c['child']) for c in cols)
        checks.append('select '+literal(child+'.'+fk['conname'])+' as constraint_name,count(*) as orphan_rows from '+child+' c where '+predicate+' and not exists(select 1 from '+parent+' p where '+join+')')
    orphans = rows(' union all '.join(checks))
    auth = rows("""select (select count(*) from auth.users) users,
      (select count(*) from auth.identities) identities,
      (select count(*) from auth.users where encrypted_password is not null and encrypted_password<>'') password_users,
      (select count(*) from auth.users where email_confirmed_at is not null) email_confirmed_users,
      (select count(*) from auth.users where banned_until>now()) banned_users,
      (select count(*) from auth.users where last_sign_in_at is not null) users_with_recorded_sign_in,
      (select count(*) from auth.users u where not exists(select 1 from auth.identities i where i.user_id=u.id)) users_without_identity,
      (select count(*) from auth.users u where not exists(select 1 from public.memberships m where m.user_id=u.id)) users_without_membership""")[0]
    history = rows('select version,name from supabase_migrations.schema_migrations order by version')
    storage = rows('select bucket_id,count(*) objects from storage.objects group by bucket_id order by bucket_id')
    environment = rows("select version() postgres_version,current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation")[0]
    relationships = rows("""select
      (select count(*) from public.candidate_documents d join public.candidates c on c.id=d.candidate_id where d.organization_id<>c.organization_id) document_org_mismatches,
      (select count(*) from public.candidate_placements d join public.candidates c on c.id=d.candidate_id where d.organization_id<>c.organization_id) placement_org_mismatches,
      (select count(*) from public.candidates c where not exists(select 1 from public.candidate_interests i where i.candidate_id=c.id)) candidates_without_interests""")[0]
    providers = rows('select provider,count(*) identities from auth.identities group by provider order by provider')
    def index(items):
        return {(x['kind'],x['key']):x['definition'] for x in items}
    expected, actual = index(reference['objects']), index(objects)
    # Compare exact catalog values, preserving whitespace inside SQL string literals.
    differences = {'missing':[], 'extra':[], 'changed':[]}
    for key in sorted(expected.keys() | actual.keys()):
        item = {'kind':key[0],'key':key[1]}
        if key not in actual: differences['missing'].append(item)
        elif key not in expected: differences['extra'].append(item)
        elif expected[key] != actual[key]:
            differences['changed'].append(dict(item, expected=expected[key], actual=actual[key]))
    expected_history = [{'version':m['name'].split('_',1)[0], 'name':m['name'].split('_',1)[1][:-4]} for m in reference['migrations']]
    checks = dict(schemaMatches=not any(differences.values()), migrationHistoryMatches=history == expected_history,
        foreignKeysValid=all(f['convalidated'] for f in fks) and not any(o['orphan_rows'] for o in orphans),
        organizationLinksValid=not relationships['document_org_mismatches'] and not relationships['placement_org_mismatches'])
    report = dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), target=TARGET, sha=reference['sha'], environment=environment, migrations=reference['migrations'], objectCounts=dict(collections.Counter(o['kind'] for o in objects)), differences=differences, tableCounts=counts, foreignKeys=fks, orphanChecks=orphans, relationships=relationships, auth=auth, authProviders=providers, migrationHistory=history, storageObjects=storage,
        limitations=['Source dump/manifest not supplied; row preservation is not established.', 'Each query batch uses a separate repeatable-read read-only snapshot; active writes may change counts between batches.', 'Auth aggregates do not prove historical account preservation or successful login.', 'PGlite uses minimal Auth/Storage stubs; extra managed Supabase objects require review.', 'Catalog deparser differences across PostgreSQL versions require review; no DDL is applied.'])
    report['checks'] = checks
    report['result'] = 'INCOMPLETE_SOURCE_MANIFEST_REQUIRED' if all(checks.values()) else 'FAIL_REQUIRES_REVIEW'
    Path(sys.argv[2]).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(dict(target=TARGET, objectCounts=report['objectCounts'], differences={k:len(v) for k,v in differences.items()}, foreignKeys=len(fks), orphanRows=sum(x['orphan_rows'] for x in orphans), auth=auth)))
    if not all(checks.values()):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
