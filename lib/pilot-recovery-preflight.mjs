// Offline planning only. This module never connects, restores, or grants access.
const sourceRef='rnstsczayhzrxzcstzpr';
const approvedTarget='hegfwnvxfrorvbknusej';
export function pilotRecoveryPreflight(snapshot,target,{storageBytesVerified=false}={}){
 const blockers=[];
 if(snapshot?.format!=='hr-ai-private-snapshot-v1'||snapshot.project_ref!==sourceRef)throw Error('UNSUPPORTED_SOURCE_SNAPSHOT');
 if(!snapshot.snapshot_at||!snapshot.tables||!Array.isArray(snapshot.auth?.users)||!Array.isArray(snapshot.auth?.identities)||!Array.isArray(snapshot.storage_inventory))throw Error('INVALID_SNAPSHOT_STRUCTURE');
 const tables=Object.values(snapshot.tables);
 if(!tables.length||tables.some(rows=>!Array.isArray(rows)))throw Error('INVALID_TABLE_PAYLOAD');
 if(!Array.isArray(snapshot.migrations)||!snapshot.migrations.length||snapshot.migrations.some(m=>!Array.isArray(m.statements)||!m.statements.length))throw Error('MIGRATION_STATEMENTS_REQUIRED');
 if(target?.projectRef!==approvedTarget)blockers.push('TARGET_NOT_EXPLICITLY_APPROVED');
 if(target?.liveEvidence!==true)blockers.push('CURRENT_TARGET_READBACK_REQUIRED');
 if(![target?.applicationTables,target?.authAccounts,target?.storageObjects].every(n=>Number.isInteger(n)&&n===0))blockers.push('EMPTY_TARGET_REQUIRED');
 if(snapshot.storage_inventory.length&&!storageBytesVerified)blockers.push('STORAGE_FILE_BYTES_REQUIRED');
 return {result:blockers.length?'BLOCKED_CLOUD_RECOVERY':'PREPARATION_CHECKS_PASSED',sourceProject:sourceRef,targetProject:target?.projectRef??null,snapshotAt:snapshot.snapshot_at,tables:tables.length,rows:tables.reduce((n,r)=>n+r.length,0),authAccounts:snapshot.auth.users.length,migrations:snapshot.migrations.length,storageInventoryObjects:snapshot.storage_inventory.length,blockers,cloudRestoreExecuted:false,authLoginTested:false,fileOpened:false,stages:['Verify current source configuration and file backup','Verify approved empty isolated target with live readback','Restore Auth records and applied schema preserving identifiers','Restore application data and validate counts and foreign keys','Restore private file bytes and policies','Test restored-account login, authorized file open and outsider denial'],limitations:['A caller-supplied target descriptor is not a live database check.','Passing preparation checks does not authorize execution, prove service compatibility, or establish cloud acceptance.']};
}
