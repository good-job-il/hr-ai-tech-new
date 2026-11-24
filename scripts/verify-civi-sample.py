"""Verify a private local Civi sample. Never sends messages or writes to the cloud."""
import csv, hashlib, json, pathlib, sqlite3, sys, zipfile
from collections import Counter

def digest(data):
    return hashlib.sha256(data).hexdigest()

def csv_rows(file):
    with file.open(encoding='utf-8-sig', newline='') as source:
        return list(csv.reader(source))

def verify(directory):
    directory=pathlib.Path(directory).resolve()
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    archive=sqlite3.connect(directory/'sample.sqlite')
    try:
        return verify_archive(directory,manifest,archive)
    except BaseException:
        archive.rollback()
        raise
    finally:
        archive.close()

def verify_archive(directory,manifest,archive):
    archive.executescript('''create table if not exists snapshots (
      source_id text, kind text, digest text, payload text not null,
      primary key(source_id,kind,digest));
      create table if not exists files (
      source_id text, kind text, digest text, payload blob not null,
      primary key(source_id,kind,digest));''')
    before=archive.total_changes
    summary=[]
    contacts=[]
    for sample in manifest['samples']:
        alias=sample['alias']; source_id=sample['sourceId']
        profile=csv_rows(directory/f'{alias}-profile.csv')
        assert len(profile)==2, 'PROFILE_ROW_COUNT'
        fields=dict(zip(profile[0],profile[1]))
        # Export number is a separate, company-local identifier, not the UI record ID.
        assert fields.get("מס' מועמד"), 'MISSING_EXPORT_NUMBER'
        assert fields.get('שם המועמד'), 'MISSING_NAME'
        contacts.append((fields.get('טלפון',''),fields.get('דוא"ל','')))
        ui={}
        for file in (directory/'ui').glob(f'{source_id}-*.json'):
            value=json.loads(file.read_text(encoding='utf-8'))
            assert digest(file.read_bytes()) in file.name, 'UI_DIGEST_MISMATCH'
            assert value['kind'] not in ui, 'MULTIPLE_REVISIONS_REQUIRE_REVIEW'
            ui[value['kind']]=value
        assert set(ui)=={'profile','events','referrals','documents'}, 'MISSING_SECTION'
        visible=ui['profile']['fields']
        assert ' '.join(fields['שם המועמד'].split())==' '.join((visible['name1']+' '+visible['name2']).split()), 'PROFILE_IDENTITY_MISMATCH'
        events=csv_rows(directory/f'{alias}-events.csv')
        assert events[1][:3]==['סוג אירוע','רכז','תאריך האירוע'], 'EVENT_SCHEMA'
        exported_events=[r for r in events[2:] if any(r)]
        event_ui=ui['events']['tables'][0]['rows']
        assert len(exported_events)==len(event_ui)==sample['events'], 'EVENT_COUNT'
        compact=lambda values: tuple(' '.join(v.split()) for v in values)
        assert Counter(compact(r[:3]) for r in exported_events)==Counter(
            compact([r['cells'][0],r['cells'][2],r['cells'][3]]) for r in event_ui), 'EVENT_METADATA_MISMATCH'
        # The raw UI details/links are retained, never reconstructed from the incomplete CSV.
        assert all(len(r['cells'])==4 for r in event_ui), 'EVENT_DETAIL_COLUMN'
        referrals=ui['referrals']['tables'][0]['rows']
        assert len(referrals)==sample['referrals'], 'REFERRAL_COUNT'
        if sample['referrals']:
            ref_export=csv_rows(directory/f'{alias}-referrals.csv')
            assert len(ref_export)-1==len(referrals), 'REFERRAL_EXPORT_COUNT'
            assert Counter(compact(r[:6]) for r in ref_export[1:])==Counter(
                compact(r['cells'][:6]) for r in referrals), 'REFERRAL_METADATA_MISMATCH'
        assert sum(len(t['rows']) for t in ui['documents']['tables'])==0, 'ATTACHMENTS_REQUIRE_CAPTURE'
        data=json.dumps({'sourceId':source_id,'kind':'profile-csv','fields':fields},ensure_ascii=False)
        archive.execute('insert or ignore into snapshots values (?,?,?,?)',(source_id,'profile-csv',digest(data.encode()),data))
        for kind,value in ui.items():
            data=json.dumps(value,ensure_ascii=False)
            archive.execute('insert or ignore into snapshots values (?,?,?,?)',(source_id,kind,digest(data.encode()),data))
        for file in sorted(directory.glob(f'{alias}-*')):
            if not file.is_file(): continue
            data=file.read_bytes()
            source=sample['downloads'].get(file.name)
            assert source and digest(pathlib.Path(source).read_bytes())==digest(data), 'DOWNLOAD_COPY_MISMATCH'
            archive.execute('insert or ignore into files values (?,?,?,?)',(source_id,file.name[len(alias)+1:],digest(data),data))
        cv=directory/(alias+'-cv'+sample['cvExtension'])
        if sample['cvExtension']=='.pdf':
            from pypdf import PdfReader
            assert len(PdfReader(cv).pages)>0, 'INVALID_PDF'
        elif sample['cvExtension']=='.docx':
            with zipfile.ZipFile(cv) as doc:
                assert doc.testzip() is None and 'word/document.xml' in doc.namelist(), 'INVALID_DOCX'
        else:
            assert cv.stat().st_size>0, 'EMPTY_TEXT_CV'
        summary.append({'alias':alias,'events':len(event_ui),'referrals':len(referrals),
          'cvFormat':sample['cvExtension'],'downloadBytesPreserved':True,
          'eventMetadataMatchesCsv':True,'fullEventDetailsArchived':True,
          'maxDetailLength':max(len(r['cells'][1]) for r in event_ui),
          'additionalAttachments':0})
    archive.commit()
    created=archive.total_changes-before
    # Verify a second insertion of the exact stored payload creates no duplicate records or files.
    before_repeat=archive.total_changes
    for table in ['snapshots','files']:
        values=archive.execute('select * from '+table).fetchall()
        archive.executemany('insert or ignore into '+table+' values (?,?,?,?)',values)
    assert archive.total_changes==before_repeat, 'REPLAY_CREATED_DUPLICATES'
    archive.commit()
    report={'sampleCandidates':len(summary),'samples':summary,'events':sum(s['events'] for s in summary),
      'referrals':sum(s['referrals'] for s in summary),'newArchiveRows':created,
      'snapshots':archive.execute('select count(*) from snapshots').fetchone()[0],
      'files':archive.execute('select count(*) from files').fetchone()[0],
      'replayCreatedDuplicates':False,'cloudWrites':0,'clientSends':0,
      'limitations':['Scoped sample only, not full Civi backup','No non-CV attachment present in sample',
      'No cloud import performed','TXT/DOCX not supported by current PDF-only product upload',
      'Event CSV alone omits full details; UI snapshots required','CSV does not establish stable event/referral IDs']}
    (directory/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    try:
        result=verify(sys.argv[1])
        print(json.dumps(result,ensure_ascii=True))
    except Exception as error:
        # Never leak a row, filename containing a name, contact, or arbitrary exception repr.
        print(json.dumps({'passed':False,'errorType':type(error).__name__,
          'check':str(error) if isinstance(error,AssertionError) else 'PRIVATE_SAMPLE_VERIFICATION_FAILED'}))
        sys.exit(1)
