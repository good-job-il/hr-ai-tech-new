export const stages = ['submitted','reviewing','interview','offer','hired','rejected'];
export function validateJob(job){
 if(!job.title?.trim() || job.title.length>120) return 'title';
 if(!job.location?.trim() || job.location.length>120) return 'location';
 if(!job.description?.trim() || job.description.length>12000) return 'description';
 if(!['full-time','part-time','contract','unspecified'].includes(job.type)) return 'type';
 return null;
}
export function filterJobs(jobs,query,type,filters={}){const q=query.trim().toLowerCase();return jobs.filter(j=>(type==='all'||j.type===type)&&(!filters.category||j.category===filters.category)&&(!filters.workMode||filters.workMode==='all'||j.work_mode===filters.workMode)&&(!filters.location||j.location?.toLowerCase().includes(filters.location.trim().toLowerCase()))&&[j.title,j.location,j.description,j.organization?.name].join(' ').toLowerCase().includes(q));}
export function canTransition(from,to){return stages.includes(from)&&stages.includes(to)&&from!==to;}
