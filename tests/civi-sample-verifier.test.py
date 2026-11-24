"""Synthetic tests only; never reads the real sample or connects to any service."""
import csv, hashlib, importlib.util, json, pathlib, tempfile, unittest
spec=importlib.util.spec_from_file_location('civi_verify',pathlib.Path(__file__).parents[1]/'scripts/verify-civi-sample.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class SampleVerifierTest(unittest.TestCase):
    def test_replay_and_identity_guard(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=pathlib.Path(temporary);(root/'ui').mkdir();(root/'original').mkdir()
            def save_csv(name,rows):
                with (root/'original'/name).open('w',encoding='utf-8-sig',newline='') as file: csv.writer(file).writerows(rows)
                (root/name).write_bytes((root/'original'/name).read_bytes())
            save_csv('sample-profile.csv',[["שם המועמד","מס' מועמד",'טלפון','דוא"ל'],['QA Sample','42','0500000000','qa@example.invalid']])
            event=['Note','Recruiter','24/11/2026 10:30','']
            save_csv('sample-events.csv',[['שם מלא:','QA Sample',''],['סוג אירוע','רכז','תאריך האירוע',''],event,event])
            (root/'original/sample-cv.txt').write_text('Synthetic CV only',encoding='utf-8')
            (root/'sample-cv.txt').write_bytes((root/'original/sample-cv.txt').read_bytes())
            detail='Full note, with punctuation\nand a second line.'
            snapshots=[{'sourceId':'123','kind':'profile','fields':{'name1':'QA','name2':'Sample'}},
              {'sourceId':'123','kind':'events','tables':[{'rows':[{'cells':['Note',detail,'Recruiter','24/11/2026 10:30'],'links':[]}]*2}]},
              {'sourceId':'123','kind':'referrals','tables':[{'rows':[]},{'rows':[]}]},
              {'sourceId':'123','kind':'documents','tables':[{'rows':[]}]}]
            for snapshot in snapshots:
                data=json.dumps(snapshot).encode();digest=hashlib.sha256(data).hexdigest()
                (root/'ui'/f"123-{snapshot['kind']}-{digest}.json").write_bytes(data)
            names=['sample-profile.csv','sample-events.csv','sample-cv.txt']
            manifest={'samples':[{'alias':'sample','sourceId':'123','events':2,'referrals':0,'cvExtension':'.txt','downloads':{name:str(root/'original'/name) for name in names}}]}
            (root/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
            first=module.verify(root);second=module.verify(root)
            self.assertEqual(first['events'],2)
            self.assertGreater(first['newArchiveRows'],0)
            self.assertEqual(second['newArchiveRows'],0)
            self.assertFalse(second['replayCreatedDuplicates'])
            save_csv('sample-profile.csv',[["שם המועמד","מס' מועמד",'טלפון','דוא"ל'],['Wrong Person','99','0500000000','qa@example.invalid']])
            with self.assertRaisesRegex(AssertionError,'PROFILE_IDENTITY_MISMATCH'): module.verify(root)

if __name__=='__main__': unittest.main()
