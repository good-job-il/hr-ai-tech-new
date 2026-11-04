from pathlib import Path
p=Path('app/home.tsx');s=p.read_text(encoding='utf-8').replace("db.auth.onAuthStateChange((_event,s)=>setSession(s))","db.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='SIGNED_OUT')setTab('jobs')})");p.write_text(s,encoding='utf-8')
