from pathlib import Path
p=Path('app/home.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('import {useEffect,useState,useRef}', 'import {Fragment,useEffect,useState,useRef}')
s=s.replace("import OrganizationDaily from './organization-daily';", "import AccountProfile from './account-profile';import OrganizationReports from './organization-reports';import OrganizationDaily from './organization-daily';")
s=s.replace("'org-company','org-reports'].includes(view)","'org-company','org-reports','account-profile'].includes(view)")
s=s.replace("setAvailableOrganizations(membershipRows.flatMap(m=>m.organization?[m.organization]:[]))", "setAvailableOrganizations(admin.data===true?[]:membershipRows.flatMap(m=>m.organization?[m.organization]:[]))")
s=s.replace("useEffect(()=>{setSaved(new Set());setPlatformAdmin(false)","useEffect(()=>{setAvailableOrganizations([]);setSelected(null);setSharingJob(null);setMessage('');setModal(null);setSaved(new Set());setPlatformAdmin(false)")
s=s.replace("userId={session.user.id} fallbackName=", "userId={session.user.id} email={session.user.email??''} fallbackName=")
s=s.replace("onProfile={()=>setTab('workspace')}","onProfile={()=>setTab('account-profile')}")
reports="...(orgCapabilities.can('reports.read')?[['org-reports','◇',lang==='he'?'דוחות':'Reports']]:[]),"
assert s.count(reports)==1
s=s.replace(reports,'').replace("['org-interviews','◇',lang==='he'?'ראיונות ומשימות':'Interviews & tasks'],", "['org-interviews','◇',lang==='he'?'ראיונות ומשימות':'Interviews & tasks'],"+reports)
old=".map(([key,icon,label])=><button key={key} className={tab===key?'active':''}"
new=".map(([key,icon,label],index,items)=><Fragment key={key}>{org&&!platformAdmin&&(index===0||key==='support'||(key.startsWith('org-')&&!['org-work','org-candidates','org-jobs','org-interviews','org-reports'].includes(key)&&!items.slice(0,index).some(([k])=>k.startsWith('org-')&&!['org-work','org-candidates','org-jobs','org-interviews','org-reports'].includes(k))))&&<span className=\"workspaceNavGroup\">{index===0?(lang==='he'?'עבודה שוטפת':'Daily work'):key==='support'?(lang==='he'?'עזרה וניווט':'Help & navigation'):(lang==='he'?'ניהול הארגון':'Organization management')}</span>}<button className={tab===key?'active':''}"
assert old in s;s=s.replace(old,new).replace('{label}</button>)}</nav>','{label}</button></Fragment>)}</nav>')
s=s.replace("{({'org-work':", "{({'account-profile':lang==='he'?'הפרופיל האישי שלי':'My personal profile','org-work':")
old="{tab==='org-reports'&&orgCapabilities.can('reports.read')&&<RecruitmentBoard apps={apps.filter(a=>a.job?.organization_id===org.id)} jobs={teamJobs} orgId={org.id} userId={session.user.id} role={role} lang={lang} onRefresh={refresh}/>}"
assert old in s;s=s.replace(old,"{tab==='org-reports'&&orgCapabilities.can('reports.read')&&<OrganizationReports org={org} apps={apps.filter(a=>a.job?.organization_id===org.id)} jobs={teamJobs} lang={lang}/>} ")
s=s.replace(" {tab==='workspace'&&", " {tab==='account-profile'&&session&&<AccountProfile key={session.user.id} email={session.user.email??''} name={String(session.user.user_metadata?.full_name??session.user.user_metadata?.name??'')} lang={lang} onSaved={async()=>{const r=await db!.auth.getSession();setSession(r.data.session)}}/>}\n {tab==='workspace'&&")
p.write_text(s,encoding='utf-8')
p=Path('app/organization-daily.tsx');s=p.read_text(encoding='utf-8')
s=s.replace("org:{id:string;name:string}","org:{id:string;name:string;kind?:string}")
s=s.replace('<div className="orgDailyStrip">','{!interviewsOnly&&<div className="orgDailyStrip">')
s=s.replace("Pending submission approvals')}</button></div>","Pending submission approvals')}</button></div>}")
s=s.replace('<div className="orgDailyColumns">','<div className={interviewsOnly?"orgDailyColumns fullWidth":"orgDailyColumns"}>')
s=s.replace('<aside className="detailPanel">','{!interviewsOnly&&<aside className="detailPanel">')
s=s.replace("onClick={()=>V('interviews')}>{t('לכל הראיונות'","onClick={()=>onNavigate('org-interviews')}>{t('לכל הראיונות'")
s=s.replace("All interviews')}</button></aside></div>","All interviews')}</button></aside>}</div>")
s=s.replace('<nav className="orgQuickLinks"','{!interviewsOnly&&<nav className="orgQuickLinks"')
s=s.replace("...(cap.can('jobs.manage')?", "...(org.kind==='agency'&&cap.can('jobs.manage')?")
s=s.replace('{label} ←</button>)}</nav></section>','{label} ←</button>)}</nav>}</section>')
s=s.replace("<p>{t('המשימות, הראיונות והמועמדים שדורשים טיפול.','Tasks, interviews and candidates that need attention.')}</p>","<p>{interviewsOnly?t('ניהול המשימות והראיונות של הארגון במקום אחד.','Manage organization tasks and interviews in one place.'):t('המשימות, הראיונות והמועמדים שדורשים טיפול.','Tasks, interviews and candidates that need attention.')}</p>")
p.write_text(s,encoding='utf-8')
