const workingProjects=new Set(['rnstsczayhzrxzcstzpr','ruejyiromtthygqtpcsy']);

/** Read-only configuration checks; never print values or contact a database. */
export function previewEnvironmentErrors(env){
 const errors=[];let database,site;
 try{database=new URL(env.NEXT_PUBLIC_SUPABASE_URL)}catch{errors.push('A separate Preview Supabase URL is required.')}
 const ref=env.PREVIEW_SUPABASE_PROJECT_REF;
 if(!ref||!/^[a-z]{20}$/.test(ref))errors.push('Declare PREVIEW_SUPABASE_PROJECT_REF for the separate test project.');
 if(database&&(database.protocol!=='https:'||database.hostname!==`${ref}.supabase.co`||database.username||database.password||database.pathname!=='/'||database.search||database.hash))errors.push('Preview Supabase URL must match the declared test project.');
 if(workingProjects.has(ref)||(database&&workingProjects.has(database.hostname.split('.')[0])))errors.push('A working Supabase project cannot be used for Preview.');
 if(!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)errors.push('The Preview project publishable key is required.');
 try{site=new URL(env.NEXT_PUBLIC_SITE_URL||(env.VERCEL_URL?`https://${env.VERCEL_URL}`:''))}catch{errors.push('A Preview site origin is required.')}
 if(site&&(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash||['www.hr-ai.tech','hr-ai.tech','headhunter-preview.vercel.app'].includes(site.hostname)))errors.push('Preview must use its own HTTPS origin.');
 if(env.NEXT_SUPABASE_DB_PASS||env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY)errors.push('Do not inherit privileged database credentials into the public Preview.');
 return errors;
}

export function assertPreviewEnvironment(env){
 const errors=previewEnvironmentErrors(env);
 if(errors.length)throw new Error('Unsafe Preview configuration:\n'+errors.map(x=>'- '+x).join('\n'));
}
