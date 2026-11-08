"""Synthetic audit checks; no network or real credentials required."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1] / 'scripts/audit-migration.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class MigrationAuditTest(unittest.TestCase):
    def run_audit(self, missing=False, orphans=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'supabase/.temp').mkdir(parents=True)
            (root / 'scripts').mkdir()
            (root / 'scripts/migration-catalog.sql').write_text('select 1;')
            (root / 'supabase/.temp/project-ref').write_text(audit.TARGET)
            (root / 'supabase/.temp/pooler-url').write_text('postgres://postgres.'+audit.TARGET+'@example.invalid:5432/postgres')
            (root / '.env.local').write_text('NEXT_PUBLIC_SUPABASE_URL=https://'+audit.TARGET+'.supabase.co\nNEXT_SUPABASE_DB_PASS=synthetic')
            objects = [{'kind':'tables','key':'public.example','definition':{'rls':True}}]
            reference = root / 'reference.json'
            output = root / 'output.json'
            reference.write_text(json.dumps({'sha':'synthetic','migrations':[{'name':'001_initial.sql'}],'objects':objects}))
            replies = iter([
                [] if missing else objects, [{'table_name':'public.example','rows':1}],
                [{'convalidated':True,'conname':'example_fk','child_schema':'public','child_table':'example','parent_schema':'public','parent_table':'parent','columns':[{'child':'parent_id','parent':'id'}]}],
                [{'constraint_name':'example_fk','orphan_rows':orphans}], [{}],
                [{'version':'001','name':'initial'}], [], [{'read_only':'on'}],
                [{'document_org_mismatches':0,'placement_org_mismatches':0}], []
            ])
            def run(command, **kwargs):
                self.assertTrue(kwargs['input'].startswith('begin isolation level repeatable read read only;'))
                self.assertIn('default_transaction_read_only=on', kwargs['env']['PGOPTIONS'])
                self.assertNotIn('synthetic', ' '.join(command))
                return subprocess.CompletedProcess(command, 0, json.dumps(next(replies)), '')
            with patch.object(audit, 'ROOT', root), patch.object(audit.sys, 'argv', ['audit', str(reference), str(output)]), patch.object(audit.subprocess, 'run', side_effect=run), contextlib.redirect_stdout(io.StringIO()):
                if missing or orphans:
                    with self.assertRaises(SystemExit) as error:
                        audit.main()
                    self.assertEqual(error.exception.code, 1)
                else:
                    audit.main()
            return json.loads(output.read_text())

    def test_matching_schema_still_requires_source_manifest(self):
        self.assertEqual(self.run_audit()['result'], 'INCOMPLETE_SOURCE_MANIFEST_REQUIRED')

    def test_missing_table_fails(self):
        self.assertFalse(self.run_audit(missing=True)['checks']['schemaMatches'])

    def test_orphan_fails(self):
        self.assertFalse(self.run_audit(orphans=1)['checks']['foreignKeysValid'])


if __name__ == '__main__':
    unittest.main()
