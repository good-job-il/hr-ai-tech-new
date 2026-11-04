from pathlib import Path
p=Path('app/home.tsx');s=p.read_text(encoding='utf-8').replace("setTab(tab==='team'?'org-work':'org-candidates')","setTab(tab==='team'?'org-work':'account-profile')")
# Private routes follow the authenticated account, never the previous account's workspace.
needle=" const accountView="
insert=" useEffect(()=>{if(!session||!privateReady)return;if(platformAdmin&&['team','dashboard','mine',...['work','candidates','jobs','interviews','team','clients','partnerships','rewards','company','reports'].map(k=>'org-'+k)].includes(tab))setTab('admin');else if(!platformAdmin&&tab.startsWith('admin'))setTab(org?'org-work':'dashboard');else if(!org&&tab.startsWith('org-'))setTab('dashboard')},[session?.user.id,privateReady,platformAdmin,org?.id,tab]);\n"
assert needle in s;s=s.replace(needle,insert+needle)
p.write_text(s,encoding='utf-8')
p=Path('app/organization-reports.tsx');s=p.read_text(encoding='utf-8').replace('apps,lang}:{org:',"apps,lang,initialJob=''}:{initialJob?:string;org:").replace("[job,J]=useState('')","[job,J]=useState(initialJob)");p.write_text(s,encoding='utf-8')
p=Path('app/organization-jobs.tsx');s=p.read_text(encoding='utf-8').replace("import RecruitmentBoard from './recruitment-board';","import RecruitmentBoard from './recruitment-board';import OrganizationReports from './organization-reports';")
s=s.replace("t('דוחות ומשימות','Reports and tasks')","t('דוח המשרה','Job report')")
s=s.replace(':<RecruitmentBoard key={job.id+tab}',":tab==='activity'?<OrganizationReports key={job.id} initialJob={job.id} org={{id:orgId,name:''}} jobs={[job]} apps={apps.filter(a=>a.job?.id===job.id)} lang={lang}/>:<RecruitmentBoard key={job.id+tab}")
p.write_text(s,encoding='utf-8')
