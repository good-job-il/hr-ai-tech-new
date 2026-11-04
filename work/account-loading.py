from pathlib import Path
p=Path('app/home.tsx');s=p.read_text(encoding='utf-8')
old="if(!current())return;if(savedRows.error)setMessage(t.error)";new="if(!current())return;if(admin.error||memberships.error){setMessage(t.error);setLoading(false);return}if(savedRows.error)setMessage(t.error)";assert old in s;s=s.replace(old,new)
needle=' return <><PerformanceDiagnostics/>'
guard=" if(session&&!privateReady)return <><div className=\"stage\">◉ {t.notice}</div><main className=\"accountLoading\"><img src=\"/brand-icon.jpg\" alt=\"HeadHunter\"/><h1>{lang==='he'?'טוען את סביבת החשבון שלך…':'Loading your workspace…'}</h1><p dir=\"ltr\">{session.user.email}</p><p role=\"status\">{message||(lang==='he'?'מאמת הרשאות ושיוך לארגון':'Checking permissions and organization membership')}</p>{message&&<button onClick={()=>void refresh()}>{lang==='he'?'ניסיון נוסף':'Try again'}</button>}<button onClick={()=>void db?.auth.signOut()}>{t.logout}</button></main></>;\n"
assert needle in s;s=s.replace(needle,guard+needle)
p.write_text(s,encoding='utf-8')
p=Path('app/brand-system.css');s=p.read_text(encoding='utf-8')+'\n.accountLoading{max-width:600px;margin:12vh auto;text-align:center;padding:32px}.accountLoading>img{width:52px;height:52px;border-radius:12px}.accountLoading h1{font-size:24px;margin:24px 0 16px}.accountLoading p{color:#79839c}.accountLoading button{margin:12px}\n';p.write_text(s,encoding='utf-8')
