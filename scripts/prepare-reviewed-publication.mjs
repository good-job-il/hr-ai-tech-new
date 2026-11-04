import fs from 'node:fs';
const dir='C:/Users/Родион/Documents/Codex/2026-10-31/referenced-chatgpt-conversation-this-is-an-2/work/expanded-jobs',rows=JSON.parse(fs.readFileSync(dir+'/publication-reviewed.json','utf8'));
if(rows.length!==200||rows.filter(r=>r.group==='management').length!==150||rows.filter(r=>r.group==='finance').length!==50||rows.some(r=>r.review!=='passed')||new Set(rows.map(r=>r.source_url)).size!==200)throw Error('Review quota or integrity failure');
const payload=JSON.stringify(rows.map(r=>({...r,career_url:r.career_url.replace(/^http:/,'https:'),status:'verified',publication_status:'draft'})));const q=s=>"'"+s.replaceAll("'","''")+"'";
fs.writeFileSync(dir+'/publish-reviewed-200.sql',`begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where lower(email)='r.rodion2802@gmail.com'),true);
create temporary table hh_reviewed_payload(data jsonb) on commit drop;
insert into hh_reviewed_payload values(${q(payload)}::jsonb);
select public.process_job_import(public.stage_job_import('reviewed-management-150-finance-50-2026-11-01.json',(select data from hh_reviewed_payload)));
update public.external_jobs e set title=x.value->>'title',description=x.value->>'description',requirements=x.value->>'requirements',responsibilities=x.value->>'responsibilities',benefits=x.value->>'benefits',department=case when x.value->>'group'='management' then 'ניהול' else 'כספים ופיננסים' end,verified_at=(x.value->>'verified_at')::timestamptz,verification_method='public-html' from hh_reviewed_payload p cross join lateral jsonb_array_elements(p.data) x where e.source_url=x.value->>'source_url' and e.publication_status='draft';
do $$declare j record;n integer;begin
 select count(*) into n from public.external_jobs e,hh_reviewed_payload p,jsonb_array_elements(p.data)x where e.source_url=x->>'source_url' and e.status='active' and e.verified_at>now()-interval '1 day';
 if n<>200 then raise exception 'Reviewed rows mismatch: %',n;end if;
 for j in select e.id from public.external_jobs e,hh_reviewed_payload p,jsonb_array_elements(p.data)x where e.source_url=x->>'source_url' loop perform public.set_external_publication(j.id,true);end loop;
end$$;
select e.department,count(*) reviewed_published from public.external_jobs e,hh_reviewed_payload p,jsonb_array_elements(p.data)x where e.source_url=x->>'source_url' and e.publication_status='published' group by e.department;
commit;
select publication_status,count(*) from public.external_jobs group by publication_status;
`);console.log(JSON.stringify({reviewed:rows.length,sqlBytes:fs.statSync(dir+'/publish-reviewed-200.sql').size}));
