import {readFile,writeFile} from 'node:fs/promises';
const d=JSON.parse((await readFile('C:/Users/Родион/Documents/Codex/2026-10-31/referenced-chatgpt-conversation-this-is-an-2/work/half-hinam/source-review.json','utf8')).replace(/^\uFEFF/,''));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
let sql=`begin;
select set_config('request.jwt.claim.sub','b3416077-6673-49f9-a277-c412e07a1b01',true);
do $$declare cid uuid;jid uuid;org uuid:='9ebb58cd-1ebb-41bd-9b6f-07883551cac9';begin
if not exists(select 1 from organizations where id=org and kind='agency' and not is_test) then raise exception 'WRONG_ORGANIZATION';end if;
select id into cid from agency_clients where organization_id=org and name='חצי חינם';
if cid is null then insert into agency_clients(organization_id,name,contact_name,contact_email,notes) values(org,'חצי חינם','אורן','orenc@hazi-hinam.co.il','פרטים אומתו ב־Civi ב־02.11.2026. תנאים מעודכנים לפי בעל הפלטפורמה: 22% משכר הבסיס לפי שעות בפועל בכל אחד משלושת חודשי ההעסקה הראשונים. מינימום 30 ימי העסקה קלנדריים. אין תקופת אחריות נפרדת. אין שליחת דוא״ל אוטומטית.') returning id into cid;end if;
perform set_client_hourly_fee(cid,22);
`;
for(const j of d.open_jobs){
 const id=new URL(j.url).searchParams.get('id');
 const location=j.title.includes('חולון')?'חולון':j.title.includes('פריסה ארצית')?'פריסה ארצית':j.description.match(/(?:^|\n)מיקום(?: המשרה)?:[ \t]*([^\n]+)/)?.[1]?.trim()||'לא צוין במקור';
 const type=/משרה מלאה/.test(j.description)&&!/מלאה או חלקית/.test(j.description)?'full-time':'unspecified';
 sql+=`if not exists(select 1 from pilot_source_jobs where source_system='civi-goodjob' and source_id=${quote(id)}) then
 insert into jobs(organization_id,client_id,title,location,type,description,status,is_public) values(org,cid,${quote(j.title)},${quote(location.slice(0,120))},${quote(type)},${quote(j.description)},'open',false) returning id into jid;
 insert into pilot_source_jobs(source_system,source_id,job_id,source_snapshot) values('civi-goodjob',${quote(id)},jid,${quote(JSON.stringify(j))}::jsonb);
end if;
`;
}
sql+=`insert into management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'agency_clients',cid,'half_hinam_pilot_prepared',jsonb_build_object('source','Civi','internal_jobs',12,'monthly_percent',22,'minimum_days',30,'warranty_days',0));
end$$;
commit;
select c.name,count(j.id) internal_jobs,bool_and(not j.is_public) all_internal,(select count(*) from client_portal_members m where m.client_id=c.id and m.active) active_portal_accounts from agency_clients c left join jobs j on j.client_id=c.id where c.organization_id='9ebb58cd-1ebb-41bd-9b6f-07883551cac9' and c.name='חצי חינם' group by c.id;
`;
await writeFile('work/half-hinam-pilot-setup.sql',sql);
