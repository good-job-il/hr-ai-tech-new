import {db} from './supabase';

export function addPipelinePlacement(orgId:string, userId:string, candidateId:string, jobId:string, source:string) {
  return db!.from('candidate_placements').insert({
    organization_id:orgId, created_by:userId, candidate_id:candidateId, job_id:jobId, source,
  }).select('id').single();
}

export function placementError(code:string|undefined, he:boolean) {
  if (code==='23505') return he?'המועמד כבר משויך למשרה.':'This candidate is already assigned to the job.';
  return he?'השיוך נכשל. בדוק את ההרשאה ואת מצב המשרה.':'Unable to assign the candidate. Check access and job status.';
}
