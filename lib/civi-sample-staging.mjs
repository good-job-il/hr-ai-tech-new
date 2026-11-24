// Private local source archive, not a production importer or a sending workflow.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function stageCiviSnapshot(directory, snapshot) {
  if(!snapshot || !/^\d+$/.test(snapshot.sourceId) || !['profile','events','referrals','documents'].includes(snapshot.kind)) throw Error('INVALID_SOURCE');
  const canonical=JSON.stringify(snapshot);
  const digest=createHash('sha256').update(canonical).digest('hex');
  const name=`${snapshot.sourceId}-${snapshot.kind}-${digest}.json`;
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,name);
  if(fs.existsSync(file)) {
    if(fs.readFileSync(file,'utf8')!==canonical) throw Error('ARCHIVE_MISMATCH');
    return {created:false,digest};
  }
  fs.writeFileSync(file,canonical,{flag:'wx',mode:0o600});
  return {created:true,digest};
}
